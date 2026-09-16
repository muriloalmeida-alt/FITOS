# Gestão de alunos (FIT-013)

Este documento detalha a implementação da FIT-013: cadastro e listagem de alunos pelo personal — a primeira funcionalidade de negócio real do FitOS, construída sobre a autorização por sessão (FIT-011) e o shell autenticado (FIT-012).

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

## O que esta História não faz

- Não implementa perfil, edição, inativação/reativação (FIT-014).
- Não implementa convite/ativação (FIT-015) — por isso todo aluno aparece apenas com status Ativo/Inativo, sem nenhuma indicação de "acesso" (Não convidado/Convite pendente/etc.), que só existe a partir da FIT-015.
- Não implementa nenhum dado de negócio (plano, treino, avaliação, cobrança).

## Testes

- `src/modules/students/students.integration.test.ts` (PostgreSQL real): cadastro válido com normalização (nome/e-mail), rejeição de nome vazio e e-mail inválido, duplicidade no mesmo tenant, mesmo e-mail permitido em tenants diferentes, e-mail já associado a uma conta existente (mensagem sem vazar o tenant), isolamento na listagem, busca por nome/e-mail, filtro por status, paginação estável sem repetir/pular registros.
- `src/app/api/students/route.test.ts` (mocks): 401/403, tenantId da query string/corpo sempre ignorado, parâmetros inválidos de status/sort/page não quebram a rota, 400 com o motivo do domínio quando o cadastro é rejeitado.
- `src/app/painel/alunos/page.test.tsx` e `.../novo/CadastrarAlunoForm.test.tsx`: redirecionamentos por papel, estados vazios (sem alunos / sem resultado de busca), paginação condicional, validação de formulário, sucesso, erro do servidor exibido ao usuário.

## Evidências

Ver `docs/06-engenharia/evidencias/FIT-013/README.md`.
