# SPRINT-05 — Gestão de Alunos

Status: em andamento — execução autônoma integral autorizada pelo Produto.

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
- FIT-014 (#32) — Perfil, edição e ciclo de vida do aluno. **Implementada** (PR próprio desta rodada).
- FIT-015 (#33) — Convite e ativação da conta do aluno. Aguarda merge da FIT-014.
- FIT-016 (#34) — Experiência inicial do aluno. Aguarda merge da FIT-015.

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

Reservado para o PR da FIT-016, conforme a regra desta Sprint de não criar PRs exclusivamente documentais.
