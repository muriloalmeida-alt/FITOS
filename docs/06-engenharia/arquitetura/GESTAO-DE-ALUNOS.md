# Gestão de alunos (FIT-013 / FIT-014)

Este documento detalha a implementação da FIT-013 (cadastro e listagem) e da FIT-014 (perfil, edição e ciclo de vida) — as duas primeiras Histórias de negócio real do FitOS, construídas sobre a autorização por sessão (FIT-011) e o shell autenticado (FIT-012).

## Onde vive a lógica

`src/modules/students/students.ts` — `createStudent`, `listStudents`, `StudentError`. Segue o mesmo padrão de `tenancy`: nenhuma função aceita `tenantId` vindo de payload/query/header — todo chamador já deve tê-lo derivado da sessão via `requirePersonal()` (FIT-011) antes de chamar qualquer função deste módulo. `client: PrismaClient = prisma` como parâmetro opcional, exclusivo para testes.

## Mudança de modelo físico: `Student` sem `User`

Até a FIT-011, `Student.userId` era obrigatório — um Student só existia depois que o aluno já tinha uma conta. Isso é incompatível com o fluxo real: o personal cadastra o aluno (nome + e-mail) **antes** de qualquer conta existir; a conta só é criada na ativação do convite (FIT-015).

Migration `20260916020000_add_student_cadastro_fields` (aditiva, com backfill seguro para linhas pré-existentes):

- `Student.userId` passa a ser opcional (`String?`). Continua único quando presente — a regra "1 User (aluno) → no máximo 1 Student" não muda.
- `Student.email` (novo, obrigatório): guarda o e-mail do aluno enquanto não existe `User` para isso. Único **por tenant** (`@@unique([tenantId, email])`), não globalmente — dois tenants diferentes podem cadastrar o mesmo e-mail antes de qualquer ativação; a colisão real (se houver) só se manifesta na ativação, onde `User.email` é globalmente único (tratada na FIT-015).
- `Student.updatedAt` (novo): preparação para a auditoria de edição da FIT-014.
- `StudentStatus` renomeado de `{ATIVO, PAUSADO, ARQUIVADO}` (especulação da FIT-007, nunca usada por nenhum código ou dado real) para `{ATIVO, INATIVO}` — os dois estados reais definidos para o ciclo de vida do aluno (SPRINT-05): sem exclusão física pela interface, apenas inativação (FIT-014).

Toda linha pré-existente de `students` (inclusive dados de teste antigos encontrados no banco de desenvolvimento) tinha `userId` obrigatório no schema anterior — o backfill da migration deriva `email` a partir do `User` já vinculado e `updatedAt` a partir do `createdAt`, sem perda de dado.

## Regra de duplicidade de e-mail — duas verificações distintas

`createStudent` faz duas checagens, deliberadamente diferentes:

1. **Mesmo e-mail já cadastrado neste tenant**: rejeitado como `StudentError("EMAIL_DUPLICADO_NO_TENANT")` — a constraint física `@@unique([tenantId, email])` garante isso mesmo sob concorrência (a violação do Postgres, código `P2002`, é traduzida para este erro de domínio).
2. **E-mail já pertence a uma conta (`User`) existente, em qualquer tenant**: rejeitado como `StudentError("EMAIL_JA_POSSUI_CONTA")`, com mensagem genérica que **não revela em qual tenant** a conta existe. Decisão deliberada: cadastrar um aluno cujo e-mail já é a credencial de outra conta tornaria a ativação (FIT-015) impossível (e-mail já ocupado) — melhor rejeitar no cadastro, com uma mensagem que não vaza a existência de dados de outro tenant.

Nenhuma das duas checagens jamais aceita o mesmo e-mail em tenants diferentes **antes de qualquer ativação** — isso é permitido e testado.

## Listagem

`listStudents` sempre restrita a `tenantId`. Busca por nome ou e-mail (`contains`, `insensitive`); filtro opcional por `status`; paginação no servidor (`skip`/`take`); ordenação estável — nome ascendente por padrão, com `id` como critério de desempate (necessário para a paginação nunca repetir nem pular um registro quando dois alunos têm o mesmo nome).

## Rota e página

- `GET /api/students` e `POST /api/students` (`src/app/api/students/route.ts`): exigem `requirePersonal()`; qualquer `tenantId` em query string/corpo é ignorado (não há esse parâmetro nas funções de domínio).
- `/painel/alunos` (lista) e `/painel/alunos/novo` (cadastro): páginas do shell do personal, protegidas pela mesma camada (`requirePersonal()`), redirecionando para `/entrar` (sem sessão) ou `/painel` (sessão de aluno) em vez de mostrar a carteira. A busca/filtro é um formulário HTML simples (`method="GET"`), sem JavaScript — funciona com paginação por link, preservando os parâmetros na URL.
- O item de navegação "Alunos" do shell do personal (`src/app/painel/navigation.ts`), que era `comingSoon: true` desde a FIT-012, passa a ter `href` real.

## Regra de produto

Aluno criado começa `ATIVO` e sem `userId` (não convidado). O cadastro nunca envia convite automaticamente — gerar o convite é uma ação separada, do personal, na FIT-015.

## Segurança e isolamento

- Nenhuma função de domínio aceita `tenantId` de fora — sempre derivado da sessão (`requirePersonal`).
- Testado: outro tenant não lista nem cadastra sobre a carteira de outro; `tenantId` adulterado em query string/corpo é ignorado (rota sempre usa o da sessão).
- Nenhum dado real de aluno é usado em teste ou evidência — apenas e-mails `@example.test` sintéticos, removidos do banco após a captura.

## O que a FIT-013 não fez (entregue pela FIT-014)

Perfil, edição, inativação/reativação.

## Perfil, edição e ciclo de vida (FIT-014)

`getStudentForTenant`, `updateStudent`, `inactivateStudent`, `reactivateStudent` (`src/modules/students/students.ts`) — todas seguem o mesmo padrão: buscam sempre por `[id, tenantId da sessão]`, nunca por `id` isolado. `getStudentForTenant` retorna `null` (não lança) quando o aluno não existe ou pertence a outro tenant — o chamador decide tratar isso como 404, sem revelar se aquele `id` existe em outro tenant.

### Regra de e-mail pós-ativação

Enquanto `Student.userId` é nulo (antes da ativação — FIT-015), o e-mail pode ser editado livremente, sujeito às mesmas duas verificações de duplicidade do cadastro. A partir do momento em que `userId` é preenchido (conta ativada), `updateStudent` **bloqueia** qualquer tentativa de alterar o e-mail (`StudentError("EMAIL_BLOQUEADO_POS_ATIVACAO")`) — decisão explícita: esta arquitetura não tem (ainda) um fluxo seguro de troca de e-mail pós-ativação (verificação, confirmação), então a alternativa seria alterar silenciosamente a credencial de login do aluno, o que a História proíbe explicitamente. Salvar o mesmo e-mail que já está lá (sem mudança real) nunca é bloqueado.

Não há convite pendente para invalidar ao editar o e-mail pré-ativação nesta História — o modelo de convite é escopo da FIT-015; quando existir, essa invalidação será responsabilidade daquela História.

### Inativação e reativação

Ambas idempotentes: chamar `inactivateStudent` sobre um aluno já `INATIVO` (ou `reactivateStudent` sobre um já `ATIVO`) apenas retorna o estado atual, sem lançar erro nem gravar um novo evento de auditoria — uma ação repetida não deve produzir ruído nem parecer uma falha. Nunca há exclusão física — apenas a coluna `status`. Não há convites para cancelar/restaurar nesta História (FIT-015).

A inativação bloqueia o acesso do aluno à experiência normal: `src/modules/tenancy/authContext.ts` (`getAuthContext`, FIT-011) agora trata um `Student` com `status: "INATIVO"` exatamente como "sem vínculo" (`tenantId`/`studentId` nulos) — `requireStudent()` rejeita com `FORBIDDEN`, a mesma resposta seria dada se o vínculo nunca tivesse existido. Essa é uma extensão mínima e deliberada da camada de autorização da FIT-011 (nenhuma mudança de tipo, nenhuma quebra de teste existente) — necessária porque o estado `INATIVO` só passou a ser alcançável através de uma ação real a partir desta História.

### Confirmação explícita antes de inativar

`/painel/alunos/[id]/inativar`: página dedicada de confirmação (nunca um "Tem certeza?" genérico) — explica o impacto ("deixa de acessar... histórico é preservado... pode reativar a qualquer momento") antes de um clique explícito em "Confirmar inativação". Reativação não exige essa confirmação — não é uma ação destrutiva/de perda de dado.

### Auditoria mínima

Toda edição, inativação e reativação grava um `AuditEvent` (`ALUNO_EDITADO`/`ALUNO_INATIVADO`/`ALUNO_REATIVADO`) na mesma transação da alteração (`$transaction`) — nunca senha, token ou dado sensível, apenas `tenantId`, `actorUserId` (o próprio personal autenticado), `action`, `entityType`, `entityId`.

### Lista padrão mostra apenas ativos

`/painel/alunos` (FIT-013) foi ajustada: sem filtro explícito na URL, a lista mostra apenas `status: ATIVO` — um aluno inativado deixa de aparecer por padrão, sem desaparecer de verdade (o personal escolhe "Inativos" ou "Todos" no filtro para vê-lo). Quando a lista padrão vem vazia mas existem alunos inativos na carteira, a página distingue essa situação de "nenhum aluno cadastrado" com uma mensagem própria, evitando uma leitura enganosa de carteira vazia.

## O que esta História (FIT-014) não faz

- Não implementa convite/ativação (FIT-015) — por isso todo aluno aparece apenas com status Ativo/Inativo, sem nenhuma indicação de "acesso" (Não convidado/Convite pendente/etc.).
- Não implementa nenhum dado de negócio (plano, treino, avaliação, cobrança).
- Não implementa a invalidação de convite pendente ao editar e-mail pré-ativação (não há convites ainda).

## Testes

- `src/modules/students/students.integration.test.ts` (PostgreSQL real, FIT-013 + FIT-014): cadastro válido com normalização, rejeição de nome vazio e e-mail inválido, duplicidade no mesmo tenant, mesmo e-mail permitido em tenants diferentes, e-mail já associado a uma conta existente (mensagem sem vazar o tenant), isolamento na listagem/perfil, busca, filtro, paginação estável; edição de nome/e-mail (pré e pós-ativação, com bloqueio), duplicidade ao editar, `NAO_ENCONTRADO` para `id` de outro tenant, inativação/reativação idempotentes com auditoria, aluno inativado some da lista padrão.
- `src/app/api/students/route.test.ts`, `.../[id]/route.test.ts`, `.../[id]/inativar/route.test.ts`, `.../[id]/reativar/route.test.ts` (mocks): 401/403/404, `tenantId` de query/corpo sempre ignorado, motivo do domínio propagado (400/404 conforme o caso).
- `src/app/painel/alunos/page.test.tsx`, `.../novo/CadastrarAlunoForm.test.tsx`, `.../[id]/page.test.tsx`, `.../[id]/EditarAlunoForm.test.tsx`, `.../[id]/inativar/page.test.tsx`: redirecionamentos por papel, `notFound` para aluno de outro tenant, estados vazios, paginação condicional, validação, sucesso, erro do servidor, e-mail bloqueado/editável conforme `userId`, confirmação explícita de inativação.
- `src/modules/tenancy/authContext.integration.test.ts`: aluno inativado tratado como sem vínculo (`getAuthContext`), `requireStudent` rejeita com `FORBIDDEN`.

## Evidências

Ver `docs/06-engenharia/evidencias/FIT-013/README.md` e `docs/06-engenharia/evidencias/FIT-014/README.md`.
