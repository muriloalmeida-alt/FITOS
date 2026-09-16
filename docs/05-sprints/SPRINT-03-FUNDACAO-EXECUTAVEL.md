# SPRINT-03 — Fundação Executável

Status: em andamento — FIT-006 concluída; FIT-007 implementada, em revisão

## Objetivo

Materializar a Fundação Técnica aprovada (EPIC-02) em uma aplicação executável e implantável, preservando as decisões de Produto, Design e Arquitetura e mantendo cada incremento pequeno, revisável e reversível.

## Épico

- EPIC-02 — Fundação Técnica (#10), mantida aberta.

## Histórias

- FIT-006 (#14) — Fundação executável do FitOS. Concluída pelo PR #17, merge `c2920e87babe09db5d525d08c5939265486413b1`.
- FIT-007 (#15) — Banco e modelo físico multi-tenant. **Implementada, em revisão** (PR próprio, sem merge; correção obrigatória de integridade relacional entregue no mesmo PR #19).
- FIT-008 (#16) — Ambientes FitOS no Railway. **Em andamento** (PR próprio, sem merge) — código e configuração de deploy entregues; provisionamento Railway (renomear ambiente, criar `fitos-postgres-hml`, configurar `DATABASE_URL`, deploy do SHA da branch) pendente por falta de credencial Railway no ambiente de execução — ver `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`.

## Resultado intermediário — FIT-006

- aplicação Next.js 16.3.5 + React 19.3.0 executável;
- TypeScript estrito e ESLint 9;
- `package-lock.json` versionado;
- `npm audit` com zero vulnerabilidades;
- Design System M3 materializado;
- estrutura modular criada sem regra de negócio;
- nenhuma persistência, autenticação, cobrança ou infraestrutura Railway implementada;
- evidências visuais versionadas;
- Issue #14 concluída.

## Resultado intermediário — FIT-007

- Prisma 6.19.3 + PostgreSQL 16, schema físico multi-tenant em `prisma/schema.prisma`;
- migration inicial reproduzível (`prisma migrate dev`/`migrate deploy`);
- constraints físicas: 1 personal = 1 tenant (`tenants.ownerId` único), aluno vinculado a exatamente 1 tenant (`students.userId` único), no máximo 1 assinatura SaaS por tenant (`saas_subscriptions.tenantId` único);
- `tenantId` denormalizado e indexado em toda tabela de domínio, para filtro direto sem depender de join;
- `StudentCharge` e `SaasSubscription` sem nenhuma relação Prisma entre si (verificado por teste);
- seeds exclusivamente sintéticos (`prisma/seed.ts`);
- testes de isolamento entre dois tenants (consulta, `updateMany`/`deleteMany` escopados por tenant errado, constraints únicas) contra PostgreSQL real;
- `npm audit` com zero vulnerabilidades (Prisma 6.19.3 escolhido deliberadamente sobre o Prisma 7, que exige um novo modelo de driver adapters — ver `docs/06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md`);
- nenhuma autenticação, UI funcional, Railway ou cobrança real implementada.

## Correção obrigatória da FIT-007 (revisão de Produto/Design/Gate Técnico)

A revisão de Produto/Design/Gate Técnico no PR #19 (head `f4a0133a3ce5cee8e6176330df0630ed8d2b0fb5`) identificou que, embora `tenantId` existisse e estivesse indexado em toda tabela de domínio, as relações entre registros (Workout→TrainingPlan, WorkoutExercise→Workout, PlanAssignment→Student/TrainingPlan, WorkoutSession→Student/Workout, Assessment→Student, StudentCharge→Student) usavam apenas o id do registro pai, sem exigir que o `tenantId` da linha filha coincidisse com o do pai — permitindo, por exemplo, um Workout do tenant A referenciar um TrainingPlan do tenant B. A revisão solicitou alterações obrigatórias antes do merge, mantendo o mesmo PR #19 (sem novo PR, branch ou História):

- substituição das foreign keys simples por foreign keys compostas `(childId, tenantId) -> (id, tenantId)`, apoiadas por `@@unique([id, tenantId])` nos modelos pai (Student, TrainingPlan, Workout) — PostgreSQL passa a rejeitar fisicamente qualquer vínculo cruzado entre tenants;
- para o caso de Exercise (catálogo global com `tenantId` nulo, ou privado de um tenant), não representável como FK composta por permitir `NULL`, um trigger PL/pgSQL (`enforce_workout_exercise_tenant`) em `workout_exercises` impõe a mesma regra a nível de banco;
- testes negativos reais contra PostgreSQL, tentando criar cada um dos 6 vínculos inválidos e comprovando a rejeição física (além de um teste positivo confirmando que exercício global pode ser usado por qualquer tenant);
- documentação (`MODELO-FISICO-DE-DADOS.md`) revisada para separar explicitamente o que a FIT-007 garante do que não garante, sem afirmar isolamento completo com base apenas em testes de consulta escopada;
- `Assessment.authorUserId` e `AuditEvent.actorUserId` permanecem com FK simples (não compostos), documentados como lacuna conhecida — dependem de um modelo de membership usuário-tenant que ainda não existe e cuja criação agora seria escopo além do solicitado;
- a referência não formalizada "FIT-006B" em `MODELO-FISICO-DE-DADOS.md` foi substituída por "história futura da prova técnica de autenticação, ainda sem identificador formal", sem criar Issue ou História nova.

Detalhes completos, SQL das constraints/trigger e evidências de validação constam no PR #19, mergeado em `main` no commit `d8cc585988dac2fc4f0a646f1352e11e5d3ecb2e`.

## Resultado intermediário — FIT-008 (em andamento)

- endpoint `GET /api/ready` (checagem de PostgreSQL via `SELECT 1`, resposta genérica em ambos os casos — nunca expõe host/credencial/stack trace), com testes cobrindo disponível (200) e indisponível (503);
- `railway.json` versionado no repositório, configurando o pré-deploy (`npm run db:migrate:deploy`, sem seed automático) e o healthcheck como código rastreável;
- topologia Railway documentada em `docs/06-engenharia/arquitetura/AMBIENTES-E-DEPLOY.md`: projeto `FitOS`, ambiente de homologação, serviço web `fitos-web-hml`, serviço de banco `fitos-postgres-hml`;
- **provisionamento Railway em si (renomear ambiente `production` → `homologacao`, criar `fitos-postgres-hml`, configurar `DATABASE_URL` por referência, disparar o deploy do SHA desta branch e executar o smoke test) não foi executado nesta rodada** — o ambiente de execução usado não tinha credencial Railway configurada. Detalhes, comandos exatos pendentes e o que fazer para concluir estão em `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`;
- nenhuma produção funcional, nenhuma API Ninjas/Better Auth/Asaas, nenhuma alteração em migration já aplicada.

## Sequenciamento obrigatório

As Histórias não são paralelas:

1. FIT-006 é implementada e submetida a PR. *(concluído — PR #17 mergeado)*
2. Produto/Design revisa e autoriza o merge. *(concluído)*
3. Somente após o merge, FIT-007 pode iniciar. *(concluído — autorizado após o merge do PR #18)*
4. FIT-007 é implementada e submetida a PR. *(concluído — PR #19 mergeado)*
5. Produto/Design revisa e autoriza o merge. *(concluído)*
6. Somente após o merge, FIT-008 pode iniciar. *(concluído — autorizado após o merge do PR #19)*
7. FIT-008 é implementada e submetida a PR. *(feito nesta rodada — parcialmente: código/config completos, provisionamento Railway pendente, ver acima)*
8. Produto/Design revisa e autoriza o merge.

## Critérios de sucesso da Sprint

- aplicação Next.js/TypeScript executa localmente;
- organização do monólito modular está materializada sem acoplamento indevido;
- Material Design 3 e identidade FitOS possuem fundação técnica reutilizável;
- modelo físico multi-tenant implementa constraints e tenant derivado no servidor;
- PostgreSQL/Prisma possuem migrations rastreáveis;
- Railway possui ambientes e deploy rastreáveis, quando FIT-008 for executada;
- nenhum segredo real é versionado;
- nenhum candidato arquitetural é promovido sem prova técnica;
- nenhuma feature Pós-MVP é introduzida;
- cada História possui PR próprio e merge explicitamente autorizado.

## Decisões preservadas

- Next.js 16 + TypeScript + React 19: confirmado (App Router exige React 19; ver Resultado intermediário da FIT-006).
- Monólito modular: confirmado.
- PostgreSQL + Prisma: confirmado e implementado na FIT-007 (Prisma 6.19.3, linha estável).
- Railway: ADR-001 Aceito (implementação na FIT-008).
- Better Auth: ADR-002 Proposto, condicionado à prova técnica; fallback Clerk.
- Asaas: ADR-003 Proposto, condicionado à prova técnica; fallback Mercado Pago.
- 1 personal = 1 tenant no MVP — agora com constraint física.
- aluno vinculado a exatamente 1 personal/tenant — agora com constraint física.
- `tenant_id` derivado no servidor — estratégia de dados implementada; derivação a partir de sessão real depende da prova técnica de autenticação.
- `StudentCharge.status`: `pendente`, `pago`, `atrasado`, `cancelado` — agora com enum físico.
- assinatura SaaS separada do financeiro do aluno — agora sem nenhuma relação física entre os modelos.

## Não incluído

- prova técnica Better Auth;
- prova técnica Asaas;
- autenticação produtiva;
- cobrança SaaS produtiva;
- integração produtiva API Ninjas;
- funcionalidades completas de Alunos, Exercícios, Treinos, Evolução ou Financeiro;
- IA, RPE/RIR, sync offline, vídeo obrigatório, Agenda, Mensagens, Relatórios avançados, Administração de academias, MFA/SSO e múltiplos personais por tenant;
- Railway/homologação (FIT-008).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) pertence à EPIC-00 e continua sendo tratada conforme o estado real do repositório. `main` permanece `"protected": false` (via `list_branches`). A SPRINT-03 não declara a `main` protegida e não altera a FIT-003. A disciplina de branch/PR/merge autorizado permanece obrigatória e é a única salvaguarda efetiva enquanto a proteção técnica não existir.

## Histórico de revisão da FIT-006

Na primeira rodada, a FIT-006 foi implementada com Next.js 15.5.25 + React 18, o que gerou uma vulnerabilidade residual moderada/alta transitiva do `postcss`. A revisão de Produto/Design/Gate Técnico no PR #17 determinou alterações obrigatórias: atualização para Next.js 16.3.5 + React 19.3.0, geração e versionamento do `package-lock.json` por `npm install`/`npm ci` (sem transcrição manual), validação limpa completa e evidência visual anexada diretamente ao PR. Após a atualização, `npm audit` reportou zero vulnerabilidades. O PR #17 foi aprovado e mergeado no SHA `074ccc3e2dac1eaf165a4ec78ea3d81aad9a8eb5`, resultando no commit `c2920e87babe09db5d525d08c5939265486413b1` na `main`. O PR documental #18 (registro da conclusão da FIT-006 e autorização da FIT-007) foi mergeado no commit `337b96c84326eba4d4f6e7d2f36dacce248a889d`.

## Fechamento

Ainda não preenchido. Reservado para PR documental posterior ao merge da FIT-008, conforme o padrão já usado na SPRINT-02. Como a SPRINT-03 tem três Histórias sequenciais, o fechamento final desta Sprint só ocorre após o merge da FIT-008.
