# SPRINT-05 — Gestão de Alunos

Status: código mergeado (4 Histórias) — aprovação formal de Produto pendente (ver "Fechamento").

## Objetivo

Entregar a gestão real de alunos do FitOS: cadastro, listagem, perfil, ciclo de vida (inativação/reativação), convite e ativação de conta, e a primeira experiência autenticada real do aluno — sem antecipar exercícios, treinos, avaliações, cobrança, agenda ou mensagens.

## Épico

- EPIC-04 — Cadastro e Relacionamento com Alunos (#30, `docs/04-backlog/EPIC-04-CADASTRO-RELACIONAMENTO-ALUNOS.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `main` sincronizada, no commit `3cde984609f344932a821bcb7bfd6e2bb5b74b5e` (merge do PR #29, FIT-012) — SPRINT-04 concluída em código, encerrada por autorização explícita do Produto ("Pode encerrar a Sprint 4").
- Autenticação, sessão, papéis, tenant derivado da sessão e shells de personal/aluno disponíveis (FIT-009 a FIT-012).
- `npm run lint`, `npm run typecheck`, `npm run test` (84/84) e `npm run build` passando na `main` antes do início desta Sprint; `npm audit` sem vulnerabilidades.
- Nenhum PR aberto conflitante.
- Nenhuma migration já aplicada foi alterada retroativamente.
- Colisão de identificadores resolvida: o backlog especulativo (`BACKLOG-MVP.md`, "Épico 2 — Alunos") já ocupava FIT-013/014/015 para um tema semelhante (cadastro/perfil/pausa de aluno), nunca promovido a Issue real. Renumerado para FIT-017/018/019, preservando ordem e conteúdo — ver nota no próprio arquivo. Nenhuma falha técnica herdada foi identificada que impedisse a gestão segura de alunos.

## Autorização de execução

Autorização integral concedida pelo Produto para formalizar, implementar, testar, documentar e mergear as quatro Histórias em sequência, sem aprovação intermediária por PR — a única exigência contínua é que cada merge só ocorra após os critérios de aceite e os quality gates da própria História serem cumpridos, com o resultado do gate autônomo registrado no PR antes do merge.

## Histórias

- FIT-013 (#31) — Cadastro e listagem de alunos. **Concluída** (PR #35, mergeado no commit `48795cd8fbb53a8442a40b2b5cee17c714c110bf`).
- FIT-014 (#32) — Perfil, edição e ciclo de vida do aluno. **Concluída** (PR #36, mergeado no commit `04412cb163941ace5dd58d6f6fdfbad413cab944`).
- FIT-015 (#33) — Convite e ativação da conta do aluno. **Concluída** (PR #37, mergeado no commit `08b8eed5b8331c87b770b1918411c49453923959`).
- FIT-016 (#34) — Experiência inicial do aluno. **PR #38** (gate autônomo aprovado — ver fechamento abaixo). Encerra a SPRINT-05.

## Resultado intermediário — FIT-013

- `src/modules/students/students.ts`: `createStudent` e `listStudents`, sempre restritos ao `tenantId` derivado da sessão (nunca de payload/query/header);
- migration `20260916020000_add_student_cadastro_fields`: `Student.userId` passa a ser opcional (aluno pode existir antes de ter conta), novo `Student.email` (único por tenant) e `Student.updatedAt`; `StudentStatus` renomeado de `{ATIVO, PAUSADO, ARQUIVADO}` (nunca usado) para `{ATIVO, INATIVO}`; backfill seguro para linhas pré-existentes;
- duas regras de duplicidade de e-mail distintas: mesmo e-mail no mesmo tenant (rejeitado) vs. e-mail já usado por uma conta existente em qualquer tenant (rejeitado com mensagem genérica, sem revelar o tenant);
- `/painel/alunos` (lista paginada, busca, filtro por status) e `/painel/alunos/novo` (cadastro) no shell do personal — item de navegação "Alunos" deixa de ser "Em breve";
- testes cobrindo isolamento entre tenants, duplicidade, paginação estável, busca, filtro, e os estados vazios (sem alunos / sem resultado de busca);
- decisão documentada em `docs/06-engenharia/arquitetura/GESTAO-DE-ALUNOS.md`.

## Resultado intermediário — FIT-014

- `getStudentForTenant`, `updateStudent`, `inactivateStudent`, `reactivateStudent` (`src/modules/students/students.ts`) — sempre restritos a `[id, tenantId da sessão]`; um `id` de outro tenant nunca é encontrado nem revelado (404 via `notFound()`, decisão deliberada e documentada);
- edição de e-mail bloqueada depois que o aluno ativa a conta (`Student.userId` preenchido) — sem fluxo seguro de troca de e-mail nesta arquitetura, a alteração é rejeitada com mensagem clara em vez de trocar silenciosamente a credencial de login;
- inativação e reativação idempotentes (ação repetida não é erro nem gera ruído de auditoria); nunca exclusão física — apenas a coluna `status`;
- aluno inativado é tratado pela camada de autorização (`getAuthContext`, FIT-011) exatamente como "sem vínculo" — `requireStudent()` rejeita com `FORBIDDEN`, bloqueando a experiência normal;
- confirmação explícita e não genérica antes de inativar (`/painel/alunos/[id]/inativar`), explicando impacto e reversibilidade;
- lista padrão de alunos (FIT-013) passa a mostrar apenas `ATIVO` por padrão, com mensagem própria para o caso "todos os alunos estão inativos" (distinta de "nenhum aluno cadastrado");
- auditoria mínima: `AuditEvent` gravado (mesma transação) em toda edição, inativação e reativação;
- decisão documentada em `docs/06-engenharia/arquitetura/GESTAO-DE-ALUNOS.md`.

## Resultado intermediário — FIT-015

- `Invitation` (migration `20260916030000_add_invitations`, aditiva): apenas o hash SHA-256 do token é armazenado; `InvitationStatus` tem só `{PENDENTE, ACEITO, CANCELADO}` — "expirado" é derivado (`expiresAt < now()`), nunca persistido;
- `generateInvitation`/`cancelInvitation` (`src/modules/students/invitations.ts`): gerar cancela qualquer convite pendente anterior do mesmo aluno; rejeita para aluno inativo ou já ativado; cancelamento idempotente; auditoria mínima;
- `activateStudentAccount` (`src/modules/identity/activation.ts`): reivindica o convite atomicamente (`updateMany` + verificação de `count`) **antes** de qualquer chamada ao Better Auth — elimina a janela de corrida por construção, não por lógica de aplicação; desfaz o provisionamento automático de tenant (FIT-010, que assume `PERSONAL`) na mesma transação que corrige o papel para `ALUNO` e vincula o `Student`; revalida e-mail em uso imediatamente antes de criar a conta;
- comprovado com teste de concorrência real (`Promise.allSettled`, duas ativações simultâneas com o mesmo token — exatamente uma sucede, nenhum `User` duplicado) e com o fluxo real de ponta a ponta (gerar → ativar → aluno autenticado → replay rejeitado → cancelar), contra o build de produção;
- rota pública `/ativar-conta` (sem sessão exigida) e `ConviteSection` no perfil do aluno ativo (gerar, copiar, cancelar, renovar);
- decisão documentada em `docs/06-engenharia/arquitetura/CONVITE-E-ATIVACAO.md`.

## Resultado intermediário — FIT-016

- `src/app/painel/page.tsx` preenche o conteúdo real do shell do aluno (FIT-012): `AlunoHome` passa a exibir personal e espaço reais (via `Student.tenant.owner`), e a distinção "nunca vinculado" vs. "vínculo inativado pelo personal" (FIT-014) é resolvida nesta página, com uma consulta direta a `Student.status` — sem alterar o contrato de segurança de `getAuthContext`/`AuthContext` estabelecido na FIT-011;
- `AlunoInativo` (novo componente): mensagem própria para "conta inativada pelo personal", distinta de `AlunoSemVinculo` ("nunca vinculada");
- `/painel/perfil` (nova): página "Sua conta" do aluno — nome e e-mail da própria sessão, protegida por `requireStudent()` (FIT-011); um personal que altere a URL manualmente é redirecionado a `/painel`, nunca vê a página (comprovado por teste e por evidência visual real);
- item de navegação "Perfil" do aluno deixa de ser "Em breve";
- nenhuma migration nesta História (nenhuma mudança de schema);
- decisão documentada em `docs/06-engenharia/arquitetura/SHELL-AUTENTICADO.md` (seção "Experiência inicial real do aluno (FIT-016)").

## Sequenciamento obrigatório

1. FIT-013 é implementada e submetida a PR.
2. Gate autônomo aprova (critérios de aceite + quality gates); merge por SHA exato.
3. Somente após o merge, FIT-014 inicia automaticamente.
4. FIT-014 é implementada e submetida a PR.
5. Gate autônomo aprova; merge por SHA exato.
6. Somente após o merge, FIT-015 inicia automaticamente.
7. FIT-015 é implementada e submetida a PR.
8. Gate autônomo aprova; merge por SHA exato.
9. Somente após o merge, FIT-016 inicia automaticamente.
10. FIT-016 é implementada e submetida a PR, incluindo o fechamento documental da SPRINT-05.
11. Gate autônomo aprova; merge por SHA exato. Sprint encerrada.

## Critérios de sucesso da Sprint

- personal cadastra, busca, lista, edita, inativa e reativa alunos — apenas do próprio tenant;
- convite de ativação é de uso único, com validade, cancelável e renovável; token nunca aparece em log ou evidência;
- aluno ativa a própria conta apenas com convite válido e autentica normalmente depois;
- aluno inativo tem acesso normal bloqueado, sem perder histórico;
- isolamento entre tenants comprovado por testes negativos reais em toda operação nova;
- nenhuma feature de negócio (Exercícios, Treinos, Avaliações, Financeiro, Agenda, Mensagens) implementada além da estrutura de cadastro/relacionamento;
- nenhuma credencial, token de convite ou dado pessoal real versionado;
- cada História possui PR próprio, gate autônomo registrado e merge explicitamente por SHA exato.

## Não incluído

- exercícios, treinos, avaliações físicas, cobrança/pagamento, agenda, mensagens;
- envio automático de convite por e-mail (apenas link copiável);
- múltiplos personais por aluno, transferência de aluno entre tenants;
- qualquer papel adicional além de PERSONAL/ALUNO.

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/PR/merge autorizado permanece a única salvaguarda efetiva.

## Fechamento

**Status da aprovação de Produto: pendente.** As quatro Histórias estão mergeadas e o EPIC-04 está tecnicamente completo, mas o encerramento formal da Sprint aguarda a aprovação do Produto — que, nesta rodada, identificou a correção descrita em "Correção pós-revisão de Produto" abaixo antes de aprovar. Esta seção será atualizada quando a aprovação ocorrer.

As quatro Histórias do EPIC-04 foram entregues em sequência, cada uma com PR próprio, gate autônomo autoverificado e merge por SHA exato — sem nenhum push direto em `main` e sem nenhuma seed automática executada:

- FIT-013 (#31) — PR #35, mergeado no commit `48795cd8fbb53a8442a40b2b5cee17c714c110bf`.
- FIT-014 (#32) — PR #36, mergeado no commit `04412cb163941ace5dd58d6f6fdfbad413cab944`.
- FIT-015 (#33) — PR #37, mergeado no commit `08b8eed5b8331c87b770b1918411c49453923959`.
- FIT-016 (#34) — PR #38, mergeado no commit `bdf1ff7fadfdb8bc3aad7006a271b631bd21cc50`.

### O que foi entregue

Um personal cadastra alunos (nome + e-mail), busca/lista/filtra/pagina, edita nome, bloqueia troca de e-mail depois que o aluno ativa a própria conta, inativa/reativa (idempotente, sem exclusão física, sem perder histórico), gera/copia/cancela/renova um link de convite de uso único e com validade de 7 dias. O aluno ativa a própria conta por esse link (nunca por cadastro público), autentica normalmente depois, vê o próprio nome/vínculo/personal/espaço na "Hoje" e os próprios dados de conta em "Sua conta" — nunca a carteira ou o shell do personal, inclusive tentando manipular a URL diretamente. Todo o isolamento é por tenant derivado da sessão, nunca de payload/query/header do cliente.

### O que não foi entregue (fora do escopo desta Sprint, por decisão de produto)

Exercícios, treinos, avaliações físicas, cobrança/pagamento, agenda, mensagens, envio automático de convite por e-mail/WhatsApp, múltiplos personais por aluno ou transferência de aluno entre tenants, qualquer papel adicional além de PERSONAL/ALUNO. O backlog especulativo correspondente (`BACKLOG-MVP.md`, "Épico 2 — Alunos") permanece registrado, agora sob FIT-017/018/019, para retomada futura.

### Correção pós-revisão de Produto (antes da aprovação do encerramento)

Na revisão de aprovação desta Sprint, o Produto identificou uma falha real de recuperação em `activateStudentAccount` (`src/modules/identity/activation.ts`, FIT-015): `signUpEmail` cria o `User` (e, por causa do hook de provisionamento automático de tenant da FIT-010, também um `Tenant`) **antes** da transação que corrige o papel para `ALUNO` e vincula o `Student`. Se essa transação falhasse por qualquer motivo depois que a conta já existia, o código só revertia o convite para `PENDENTE` — sem desfazer a conta já criada. Resultado possível: um `User` com o e-mail do aluno, sem `Student` vinculado, e nenhuma nova tentativa de ativação capaz de recriar a conta (`EMAIL_EM_USO` permanente, sem saída). O teste de integração existente usava uma instância de Better Auth sem o hook de provisionamento (para não violar FK entre bancos diferentes), então cobria apenas o caminho de sucesso — nunca essa recuperação de falha.

**Corrigido** em PR #39 (fora das quatro Histórias — correção sobre código já mergeado da FIT-015, antes da aprovação final do encerramento da Sprint; aguardando decisão do Produto para merge — ver status no topo desta seção): a conta já criada é explicitamente desfeita (tenant automático removido primeiro, por causa da FK `onDelete: Restrict`; depois o `User`, com `Session`/`Account` em cascata) sempre que qualquer etapa posterior falhar, antes de reverter o convite. Novo teste de integração comprova a recuperação completa: falha simulada na transação de vínculo → nenhum `User` órfão sobra → convite volta a `PENDENTE` → uma nova tentativa com o mesmo token ativa normalmente. Detalhe técnico completo em `docs/06-engenharia/arquitetura/CONVITE-E-ATIVACAO.md`.

### Migrations e homologação

Duas migrations aditivas nesta Sprint (`20260916020000_add_student_cadastro_fields`, FIT-013; `20260916030000_add_invitations`, FIT-015); nenhuma migration anterior alterada; nenhuma constraint multi-tenant removida; nenhuma seed automática executada. FIT-014 e FIT-016 não precisaram de migration.

**Limite explícito, mantido conforme apontado pelo Produto na revisão**: as duas migrations foram comprovadas aplicando-as de fato (`prisma migrate deploy`) em `fitos_dev` e `fitos_test` — bancos locais ao ambiente de execução —, **não** no ambiente de homologação do Railway. Nenhum deploy, migration ou verificação de schema foi executado contra Railway nesta Sprint. `/api/ready` retornando 200 (quando mencionado em qualquer evidência) atesta apenas que a aplicação está no ar e conectada a **algum** banco — não comprova que o schema de homologação está no estado esperado pelas migrations desta Sprint. Antes de qualquer promoção real para homologação/produção, as migrations precisam ser aplicadas e validadas ali explicitamente, fora do escopo desta Sprint.

### Evidências

`docs/06-engenharia/evidencias/FIT-013/`, `FIT-014/`, `FIT-015/` e `FIT-016/` — todas capturadas com Playwright contra o build de produção (`npm run start`), fluxo real de UI/rotas, dados sintéticos removidos do banco imediatamente após cada captura.

### Riscos residuais

- A FIT-003 (proteção técnica da `main`) continua pendente — `main` permanece `"protected": false`; a disciplina de branch/PR/merge autorizado é a única salvaguarda efetiva (risco já conhecido, não introduzido por esta Sprint).
- Não há fluxo de troca de e-mail pós-ativação (rejeitado explicitamente, não implementado) — aceitável para o MVP, mas é uma limitação real relatada ao aluno/personal via mensagem, não um caminho alternativo.
- Convite expirado é derivado (`expiresAt < now()`), nunca persistido — decisão deliberada (evitar estado duplicado/redundante), sem job de expiração assíncrono; nenhum efeito colateral identificado, já que toda leitura relevante já recalcula a validade em tempo real.

### Estado final do EPIC-04

Todas as quatro Histórias (FIT-013 a FIT-016) concluídas e mergeadas — EPIC-04 encerrado nesta Sprint.

### Confirmações

- Nenhum push direto em `main` em nenhuma História — todo código passou por PR e merge explícito por SHA validado.
- Nenhuma seed automática foi executada — os únicos dados criados fora de teste automatizado foram sintéticos, usados exclusivamente para evidência visual, e removidos do banco (`fitos_dev`) imediatamente após cada captura.
- Nenhum ambiente de produção foi tocado — todo trabalho ocorreu em `fitos_dev`/`fitos_test` locais ao ambiente de execução.

### Proposta breve para a SPRINT-06 (não iniciada)

Com cadastro/relacionamento de alunos completo, a próxima fronteira natural é a operação diária do personal com o aluno já vinculado: um cadastro mínimo de exercícios/treinos (sem ainda prescrever), ou a evolução do perfil do aluno com dados físicos básicos (peso/medidas) para permitir a primeira avaliação simples — qualquer uma das duas abre caminho direto para "Treino"/"Progresso" deixarem de ser "Em breve". Recomendação: priorizar exercícios/treinos, por ser a funcionalidade mais valiosa para o personal justificar a assinatura do produto; avaliação física pode vir imediatamente depois, reaproveitando o mesmo `Student` já modelado. Esta proposta não inicia nenhum trabalho de código — aguarda autorização explícita do Produto.
