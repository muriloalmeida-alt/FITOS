# ADR-006 — Workspace individual como `Tenant.type`, não uma entidade nova

Status: **Aceito** (FIT-100, EPIC-13 — FitOS Livre)
Data: 21 de setembro de 2026

## Contexto

O pacote `FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3.zip` define a Fase 2.2 (EPIC-13, "FitOS Livre"): uma pessoa que treina sozinha, sem personal, deve conseguir usar o FitOS para montar e registrar o próprio treino. Todo o modelo físico existente (`Tenant`, `Student`, `TrainingPlan`, `Workout`, `WorkoutSession`, etc.) foi desenhado sob a premissa de que um tenant é sempre um personal trainer e que um `Student` é sempre uma pessoa diferente do dono do tenant, vinculada a ele.

FIT-100 ("Criar workspace individual") é a primeira História: precisa de um lugar para o praticante existir na aplicação — um tenant — antes de qualquer decisão sobre como ele cria/executa treino (isso é FIT-102, deliberadamente fora do escopo desta História).

## Alternativas consideradas

1. **Nova entidade `IndividualWorkspace`, paralela a `Tenant`.** Rejeitada: duplicaria toda a superfície de isolamento por tenant já construída (constraints físicas, triggers de integridade relacional composta, `authContext.ts`, `assertTenantAccess`) para um segundo conceito estruturalmente idêntico — um contêiner de dados isolado, dono de um usuário. Multiplicaria a superfície de auditoria de segurança sem nenhum ganho real.
2. **Reaproveitar o `Tenant` existente sem nenhum campo novo, tratando "o personal é o próprio aluno" como um caso particular.** Rejeitada: um `Tenant` hoje não tem "aluno" — `Student` é sempre uma segunda pessoa (FIT-007: `Student.userId` é distinto de `Tenant.ownerId` em todo o modelo de negócio e nas regras de autorização). Forçar isso sem nenhuma marcação explícita esconderia a diferença de papel em nível de dado, obrigando toda consulta futura a inferir "é individual" por ausência de alunos — fragilidade que cresce com o tempo, não decisão explícita.
3. **`Tenant.type: TenantType` (`PERSONAL` | `INDIVIDUAL`), aditivo, com `@default(PERSONAL)`** (escolhida): um tenant continua sendo exatamente o mesmo conceito físico — um contêiner isolado por `tenantId`, com as mesmas constraints e triggers de sempre — só ganha um rótulo que diz que tipo de dono ele tem. Nenhuma linha existente muda de significado (todo `Tenant` de hoje é implicitamente `PERSONAL`, e o `@default` torna isso explícito sem migração de dados).

## Decisão

`Tenant.type: TenantType` (novo enum `PERSONAL`/`INDIVIDUAL`, `@default(PERSONAL)`) e `UserRole.INDIVIDUAL` (novo valor do enum já existente `UserRole`), ambos puramente aditivos — migration `20260921230135_add_individual_workspace` só cria o novo tipo/valor e a nova coluna com default, sem tocar nenhuma linha existente.

`ensureTenantForIndividual` (`src/modules/tenancy/ensureTenantForIndividual.ts`) espelha `ensureTenantForPersonal` (FIT-010) na íntegra: mesma idempotência (busca antes de criar), mesma resolução de concorrência (a constraint física `tenants.ownerId @unique` decide a corrida real; a chamada perdedora captura o erro `P2002` e busca o tenant que a vencedora criou). `authContext.ts` (FIT-011) ganha um terceiro ramo em `getAuthContext` — simétrico ao de `PERSONAL` — e um novo guard `requireIndividual()`; `requirePersonal`/`requireStudent` continuam rejeitando qualquer papel que não seja exatamente o esperado, `INDIVIDUAL` incluído, sem nenhuma mudança na lógica desses dois guards.

**Deliberadamente fora do escopo desta História**: como o próprio praticante (o dono do tenant `INDIVIDUAL`) se relaciona com `Workout`/`WorkoutSession`/`TrainingPlan` — reaproveitar `Student` como uma auto-referência (o dono também sendo um `Student` do próprio tenant) ou desenhar um caminho que não passe por `Student` nenhum. `ensureTenantForIndividual` não cria nenhum `Student` nem qualquer dado de treino — só o tenant. Essa decisão é da FIT-102 ("Criar treino individual"), quando a necessidade concreta (qual tabela grava o quê) tiver que ser resolvida com o desenho real da tela.

## Consequências

- Toda a superfície de isolamento por tenant já existente (constraints físicas, triggers `enforce_workout_exercise_tenant`/`enforce_exercise_tenant_immutability`, `assertTenantAccess`) vale para um tenant `INDIVIDUAL` exatamente como vale para um `PERSONAL`, sem nenhum código novo de enforcement — comprovado em `isolation.integration.test.ts` (FIT-100): um tenant `INDIVIDUAL` é tratado pelas mesmas regras físicas que dois tenants `PERSONAL` entre si.
- Nenhuma migração de dado foi necessária; todo `Tenant` pré-existente permanece `PERSONAL` por default, sem ambiguidade.
- Um usuário `INDIVIDUAL` nunca é tratado como `ALUNO` mesmo que, no futuro, essa pessoa também venha a contratar um personal — a transição entre esses dois mundos (ver `05_TRANSICAO_PERSONAL_PARA_LIVRE.md` do pacote) é decisão de produto ainda não implementada; hoje os três papéis (`PERSONAL`, `ALUNO`, `INDIVIDUAL`) são mutuamente exclusivos e fixos por usuário.
- Nenhuma rota pública produz `role: "INDIVIDUAL"` ainda — o campo continua `input: false` em `auth.ts` até a FIT-101 (onboarding "Treino sozinho") decidir o fluxo de cadastro real.
