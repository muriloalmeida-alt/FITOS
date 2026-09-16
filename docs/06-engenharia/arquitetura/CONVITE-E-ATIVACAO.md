# Convite e ativação da conta do aluno (FIT-015)

Este documento detalha a implementação da FIT-015: como o personal convida um aluno já cadastrado (FIT-013) a ativar sua própria conta, e como essa ativação acontece de forma segura — sem cadastro público de aluno (FIT-009), sem duplicar contas, sem permitir replay do link.

## Divisão entre módulos

Metade "personal" (gerar/cancelar convite, ver status) em `src/modules/students/invitations.ts` — é sobre a carteira do personal. Metade "ativação" (validar token, criar a conta) em `src/modules/identity/activation.ts` — "ativação de acesso" é responsabilidade de `identity` (`VISAO-ARQUITETURAL.md`). As duas se encontram apenas em `hashInvitationToken`, exportada por `invitations.ts` e importada por `activation.ts` — uma única direção de dependência, sem ciclo.

## Modelo físico: `Invitation`

Migration `20260916030000_add_invitations` (aditiva). Um convite por vez é o modelo real: gerar um novo convite **cancela** (nunca apaga) qualquer `PENDENTE` anterior do mesmo aluno, na mesma transação — nunca dois convites válidos simultaneamente para o mesmo aluno.

`InvitationStatus` tem apenas `{PENDENTE, ACEITO, CANCELADO}` — as transições reais, disparadas por uma ação. **"Convite expirado" é um estado derivado, não persistido**: `expiresAt < now()` sobre um convite ainda `PENDENTE`. Não existe (nem precisa existir) nenhuma tarefa periódica "expirando" convites em lote — a validade é sempre calculada no momento da leitura (`checkActivationToken`, `activateStudentAccount`, `deriveAccessStatus`). Essa é uma decisão técnica deliberada, resolvida nesta rodada sem precisar de aprovação do Produto: persistir um estado puramente derivado do tempo duplicaria uma informação já obtida de `expiresAt`.

## Token: geração, hash, nunca em texto puro persistido

- **Geração**: `crypto.randomBytes(32)` (CSPRNG do Node/OpenSSL) codificado em base64url — 256 bits de entropia, imprevisível.
- **Armazenamento**: apenas `SHA-256(token)` (`tokenHash`, coluna `@unique`). O token bruto existe unicamente no retorno de `generateInvitation` (`{ invitation, rawToken }`) — a rota monta o link com ele e a variável é descartada ao fim da requisição. Nunca é logado, nunca volta a aparecer em nenhuma resposta HTTP depois da geração, nunca é gravado em auditoria.
- **Validade**: 7 dias (`INVITATION_VALIDITY_DAYS`), documentada e constante — não configurável por variável de ambiente nesta rodada (decisão de simplicidade, revisável).

## Estado de acesso apresentado na interface (derivado)

`deriveAccessStatus(student, latestInvitation)` — nunca uma coluna própria, sempre calculado a partir de `Student.userId` e do convite mais recente:

- `CONTA_ATIVA`: `student.userId` preenchido (decidido por isso, não por `invitation.status === "ACEITO"` — os dois são preenchidos na mesma transação de ativação, mas `userId` é a fonte mais direta).
- `NAO_CONVIDADO`: nenhum convite existe.
- `CONVITE_CANCELADO`: o convite mais recente foi cancelado.
- `CONVITE_PENDENTE` / `CONVITE_EXPIRADO`: convite `PENDENTE`, distinguidos por `expiresAt` comparado a agora.

## Fluxo de ativação — ordem deliberada por segurança

`activateStudentAccount` (`src/modules/identity/activation.ts`):

1. **Valida o token** (existe, `PENDENTE`, não expirado) — leitura simples.
2. **Reivindica o convite atomicamente**: `invitation.updateMany({ where: { id, status: "PENDENTE" }, data: { status: "ACEITO" } })`, com o `count` do resultado verificado. Isso acontece **antes de qualquer chamada ao Better Auth** — uma segunda requisição concorrente com o mesmo token nunca encontra `count === 1` de novo (o `UPDATE` do Postgres é atômico), então nunca chega a criar uma conta. Não existe um usuário "perdedor" órfão para limpar — a exclusividade é garantida pela camada de dados, não por lógica de aplicação.
3. **Revalida e cria a conta**: confirma que o `Student` ainda não tem `userId` (defesa em profundidade) e que o e-mail ainda não pertence a nenhum `User` (pode ter sido criado no intervalo entre o cadastro do aluno e a ativação) — só então chama `auth.api.signUpEmail({ email: student.email, password, name: student.displayName }, { returnHeaders: true })`.
4. **Corrige o efeito colateral do hook da FIT-010**: `signUpEmail` cria o `User` com `role` padrão `PERSONAL` (`input: false` força o `defaultValue` mesmo quando o chamador tenta passar outro valor — comportamento confirmado lendo `parseInputData` no código-fonte do Better Auth, não assumido) — o que dispara `databaseHooks.user.create.after` (FIT-010) e provisiona um tenant indevido. Uma única transação desfaz isso: apaga o tenant recém-criado (`tenant.deleteMany({ ownerId })`), corrige `role` para `ALUNO`, e vincula `Student.userId` (com `updateMany` + verificação de `count`, mesma defesa em profundidade da etapa 2).
5. Se qualquer etapa depois da reivindicação falhar, o convite volta a `PENDENTE` (best-effort) para que o aluno possa tentar de novo com um link ainda válido. Duas famílias de falha, tratadas de formas diferentes:
   - **Antes de `signUpEmail`** (ex.: e-mail em uso): nenhuma conta foi criada — só reverter o convite já é suficiente.
   - **Depois de `signUpEmail`** (ex.: a transação da etapa 4 falha por erro de conexão, ou `linkResult.count !== 1`): o `User` **já existe** nesse ponto. Reverter apenas o convite não bastaria — o e-mail do aluno ficaria permanentemente "ocupado" por uma conta sem `Student` vinculado, e nenhuma nova tentativa de ativação conseguiria recriar a conta (`EMAIL_EM_USO` sem saída, mesmo com um convite novo). Por isso, nesse caso, a conta criada é desfeita explicitamente antes de reverter o convite: primeiro qualquer `Tenant` que o hook da FIT-010 tenha provisionado (`tenant.deleteMany({ ownerId })` — a relação `Tenant.owner` é `onDelete: Restrict`, então o `User` não pode ser removido enquanto ainda tiver um tenant), depois o próprio `User` (`user.delete`, que em cascata remove `Session`/`Account`, ambas `onDelete: Cascade`). **Correção identificada na revisão de Produto da SPRINT-05, antes da aprovação do encerramento** — o comportamento original apenas revertia o convite, sem desfazer a conta já criada; corrigido no PR #39 (ver `activation.integration.test.ts`, caso "falha na etapa de vínculo após a conta já criada").
6. `signUpEmail` com `autoSignIn: true` (já configurado desde a FIT-009) retorna cabeçalhos `Set-Cookie` reais (`returnHeaders: true`, mesmo padrão usado no teste de logout da FIT-009) — a rota HTTP repassa esses cabeçalhos para o navegador do aluno, que termina a ativação já autenticado, sem precisar fazer login separadamente.

### Por que essa ordem, e não "criar a conta primeiro"

Uma ordem alternativa (criar a conta e só depois marcar o convite como aceito) deixaria uma janela onde duas requisições concorrentes poderiam, ambas, passar a validação inicial e ambas chamar `signUpEmail` — como `User.email` é globalmente único, uma delas falharia no Better Auth, mas só depois de já ter feito trabalho real (e, dependendo do erro, potencialmente deixado um `User` criado sem nenhum `Student` vinculado). Reivindicar o convite **primeiro**, com uma operação atômica de banco, elimina essa janela por construção.

## Nunca revela dados do aluno para token inválido

`checkActivationToken` (leitura, usada pela página pública) e a etapa 1 de `activateStudentAccount` tratam de forma idêntica: inexistente, expirado, cancelado, ou já usado — todos retornam a mesma resposta genérica (`{ valid: false }` / `AuthError("TOKEN_INVALIDO")`, mensagem "Este link não é válido ou já expirou."). Nenhum desses casos chega a consultar ou expor `displayName`/`email` do aluno.

## Conflitos de e-mail

- **No cadastro** (FIT-013): e-mail já usado por um `User` existente → rejeitado no cadastro (`EMAIL_JA_POSSUI_CONTA`) — evita um convite que nunca poderia ser aceito.
- **Na ativação**: mesmo assim, o e-mail é revalidado (`existingAccount` check) imediatamente antes de `signUpEmail`, porque o tempo entre cadastro e ativação pode ser longo — uma conta com esse e-mail pode ter sido criada nesse intervalo (por qualquer via). Rejeitado com `EMAIL_EM_USO`, convite revertido para `PENDENTE`. Nunca enfraquece a constraint `User.email @unique` para "resolver" esse conflito.

## Rota pública

`/ativar-conta?token=...` (`src/app/ativar-conta/`) não exige sessão — o token é a própria autorização. `POST /api/ativar-conta` nunca loga token nem senha; propaga o `Set-Cookie` real da sessão criada.

## Segurança

- Token nunca em log, nunca em evidência versionada (as capturas em `docs/06-engenharia/evidencias/FIT-015/` usam apenas tokens sintéticos, gerados e imediatamente invalidados/descartados nesta rodada de captura, contra dados sintéticos removidos do banco depois).
- `AuditEvent` registrado em `CONVITE_GERADO`/`CONVITE_CANCELADO` — nunca com o token, apenas `tenantId`/`actorUserId`/`entityId`.

## O que esta História não faz

- Não envia e-mail automaticamente — o MVP entrega apenas o link para o personal copiar e enviar por fora (WhatsApp, e-mail manual, etc.), conforme escopo definido pelo Produto.
- Não implementa múltiplos personais por aluno nem transferência de aluno entre tenants.
- Não configura storage compartilhado para o rate limiting do Better Auth (achado na FIT-012) — risco residual já registrado, não resolvido aqui.

## Testes

- `src/modules/students/invitations.integration.test.ts` (Postgres real): geração com validade de 7 dias e auditoria, regeneração cancela o anterior, rejeição para aluno inativo/já ativado, isolamento entre tenants, cancelamento idempotente, todos os 5 estados de `deriveAccessStatus`.
- `src/modules/identity/activation.integration.test.ts` (Postgres real, instância própria do Better Auth sem o hook de tenant — ver nota no próprio arquivo): ativação feliz (`User` `ALUNO`, `Student.userId` vinculado, convite `ACEITO`, login real funciona depois), token inexistente/expirado/cancelado, replay do mesmo token após uso, **ativação concorrente com o mesmo token — exatamente uma sucede, nenhum `User` duplicado**, e-mail já em uso (convite revertido a `PENDENTE`), **falha simulada na transação de vínculo depois que `signUpEmail` já criou a conta — o `User` órfão é removido, o convite volta a `PENDENTE`, e uma nova tentativa com o mesmo token ativa normalmente** (via um `client` de teste cujo `$transaction` é forçado a rejeitar, confirmando que sem a limpeza o `User` sobrevive — regressão coberta), token nunca aparece em texto puro no banco.
- Rotas (`convite`, `ativar-conta`) e páginas/componentes (`ConviteSection`, `AtivarContaForm`, página pública): mocks cobrindo 401/403/400, `tenantId`/`userId` sempre da sessão, `Set-Cookie` repassado, mensagens sem vazar dados do aluno.

## Evidências

Ver `docs/06-engenharia/evidencias/FIT-015/README.md` — fluxo completo real (gerar, ativar, replay rejeitado, cancelar) contra o build de produção.
