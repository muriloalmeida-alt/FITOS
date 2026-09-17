# Treinos e planos (SPRINT-07)

Este documento detalha a implementação da EPIC-06/SPRINT-07 (FIT-030 a FIT-033): modelo de treino, duplicação, plano semanal e atribuição ao aluno. Complementa (não substitui) `docs/01-produto/REGRAS-DE-NEGOCIO.md`, `docs/01-produto/MODELO-DE-DADOS.md`, `docs/06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md` e `docs/06-engenharia/arquitetura/adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md`.

## Mapeamento de conceito de produto → modelo físico

| Termo de produto | Modelo Prisma | Observação |
|---|---|---|
| Modelo de treino | `Workout` | Sempre pertence a exatamente um `TrainingPlan` (FK obrigatória, já assim desde a FIT-007) — "reutilizável" é resolvido por **duplicação** (FIT-031), nunca por referência compartilhada entre planos. |
| Item de treino / prescrição | `WorkoutExercise` | Referencia um `Exercise` do catálogo (global ou próprio); carrega os parâmetros de prescrição. |
| Plano semanal | `TrainingPlan` | Agrupa um ou mais `Workout` (dias/semana). |
| Atribuição | `PlanAssignment` | Referencia uma **cópia imutável** de `TrainingPlan`, nunca o modelo editável do personal — ver ADR-005. |

## Por que "reutilizável" não é uma relação muitos-para-muitos

`docs/01-produto/REGRAS-DE-NEGOCIO.md` já resolve essa pergunta explicitamente: **"Duplicar um modelo cria uma nova entidade sem vínculo de atualização automática."** Isso é a decisão de produto para como o reaproveitamento funciona — copiar, não compartilhar. Compartilhar o mesmo `Workout` entre planos diferentes (uma relação muitos-para-muitos) reintroduziria exatamente o problema que o versionamento por cópia (ADR-005) existe para evitar: editar um `Workout` compartilhado afetaria retroativamente todo plano que o referencia, inclusive planos já atribuídos a outros alunos. Nenhuma migration antiga foi alterada para viabilizar essa leitura — o schema da FIT-007 (`Workout.trainingPlanId` obrigatório) já era compatível com ela.

## FIT-030 — Criar modelo de treino

`src/modules/workouts/workouts.ts`: `createWorkout`, `getWorkoutForTenant`, `listWorkoutsForTenant`, `updateWorkout`, `archiveWorkout`, `reactivateWorkout`, `addWorkoutExercise`/`getWorkoutExerciseForTenant`/`listWorkoutExercisesForWorkout`/`updateWorkoutExercise`/`removeWorkoutExercise`/`reorderWorkoutExercises` — mesmo padrão de `exercises.ts` (FIT-022): `tenantId` sempre derivado da sessão pelo chamador, nunca campo editável.

### Plano "rascunho" implícito (bootstrapping até a FIT-032)

`Workout.trainingPlanId` é uma FK obrigatória desde a FIT-007 — todo modelo precisa de um `TrainingPlan`. Como a criação real de plano semanal só chega na FIT-032, `ensureDraftTrainingPlanForTenant` obtém (ou cria, na primeira chamada) um único `TrainingPlan` "rascunho" por tenant (`isSnapshot: false`, o primeiro criado) para hospedar os modelos avulsos desta História. Não é um conceito novo exposto ao personal na UI — é só o "lugar" físico onde os modelos moram até existir um builder de plano de verdade; a partir da FIT-032, o personal poderá criar plano(s) reais com nome/dias/vigência próprios.

### Migration aditiva

`prisma/migrations/<timestamp>_add_workout_prescription_and_status/`:

- `WorkoutExercise` recebe os parâmetros de prescrição (`docs/03-design/CRITICAL-SCREEN-SPECS.md`, "Builder de treino → Parâmetros": séries, repetições ou duração, carga, descanso, observação — RPE/RIR e vídeo são pós-MVP, não implementados): `sets Int?`, `reps Int?`, `durationSeconds Int?`, `load String?` (texto livre — carga nem sempre é um número em kg: peso corporal, elástico, "RM", mesmo padrão já usado em `Exercise.difficulty`/`equipments`), `restSeconds Int?`, `notes String?`. Todos opcionais — "cada item aceita parâmetros de prescrição **conforme o exercício**" (um exercício de duração, como prancha, não usa `reps`).
- `Workout` recebe `status WorkoutStatus @default(ATIVO)` (`ATIVO`/`ARQUIVADO`, mesmo enum-por-domínio já usado em `ExerciseStatus`) e `suggestedDays String[] @default([])` (dias sugeridos da semana, ex. `["SEGUNDA", "QUARTA"]` — texto livre validado na aplicação, não um enum de banco, para não engessar a lista antes do produto validar os rótulos com uso real).
- `TrainingPlan` recebe `status TrainingPlanStatus @default(ATIVO)` e `durationWeeks Int?` ("vigência sugerida" — um número simples de semanas; datas de calendário concretas só existem na atribuição, FIT-033, nunca no modelo reutilizável).
- `isSnapshot Boolean @default(false)` em `TrainingPlan` — ver ADR-005; nesta História a flag existe e é sempre `false` (nenhuma atribuição/clone ainda), mas a migration já a inclui para que a FIT-033 não precise de uma segunda migration estrutural em `training_plans`.

Nenhuma migration anterior foi editada; nenhum trigger de isolamento (`enforce_workout_exercise_tenant`, `enforce_exercise_tenant_immutability`) alterado. Testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).

### Regras aplicadas

- `tenantId` sempre da sessão; nenhuma função aceita `tenantId` como payload de cliente.
- `getWorkoutForTenant` nunca retorna `Workout` de outro tenant — `NAO_ENCONTRADO` nesse caso, sem diferenciar de "não existe".
- Exercício referenciado por `WorkoutExercise` pode ser global ou próprio do tenant — nunca próprio de outro tenant (regra já imposta pelo TRIGGER `enforce_workout_exercise_tenant`, FIT-007 — este módulo não duplica a checagem em SQL, mas o teste de integração comprova que o TRIGGER rejeita a tentativa).
- Arquivamento nunca é exclusão física; idempotente (mesmo padrão de `archiveExercise`).
- Reordenar/remover itens não afeta a posição relativa dos demais além do necessário (sem buracos, sem duplicar posição).

### O que esta História não faz

- Não implementa plano semanal (`TrainingPlan` como agrupador de múltiplos `Workout` com dias/vigência) — FIT-032.
- Não implementa duplicação de modelo — FIT-031.
- Não implementa atribuição nem a cópia imutável — FIT-033 e ADR-005 (a flag `isSnapshot` já existe no schema desta migration, mas nada nesta História a usa, exceto o próprio TRIGGER de imutabilidade — ver abaixo).
- Não implementa fluxo de "rascunho/publicado" (`salvar e publicar`, `CRITICAL-SCREEN-SPECS.md`) — o MVP entrega salvar/editar direto; decisão de escopo registrada em `docs/04-backlog/EPIC-06-TREINOS-E-PLANOS.md`.
- Não implementa drag handle de fato (`CRITICAL-SCREEN-SPECS.md` menciona "canvas ordenável"/drag handle) — a reordenação é feita por botões "▲"/"▼" chamando `reorderWorkoutExercises`; funcionalmente equivalente (o personal ordena os itens), mas sem o gesto de arrastar. Decisão de escopo pelo mesmo motivo da FIT-023 favorecer simplicidade de implementação nesta rodada — pode ser revisitado como refinamento de UI futuro.

### TRIGGER de imutabilidade de snapshot (ADR-005)

Embora nenhuma linha desta História marque `isSnapshot: true` (isso só acontece na FIT-033), o TRIGGER que impõe essa imutabilidade (`enforce_snapshot_immutability_workouts`/`enforce_snapshot_immutability_workout_exercises`, mais o TRIGGER que impede `isSnapshot` voltar a `false`) já é criado por esta migration — para que a FIT-033 não precise de uma segunda migration estrutural em `workouts`/`workout_exercises`. Testado de forma isolada (Postgres real, sem depender da FIT-033 existir) em `workouts.integration.test.ts`.

### Páginas (`src/app/painel/treinos/`)

- `page.tsx` — lista de modelos ativos do tenant (`listWorkoutsForTenant`), com dias sugeridos visíveis; estado vazio honesto.
- `novo/page.tsx` + `CriarModeloForm.tsx` — criação (nome obrigatório).
- `[id]/page.tsx` — detalhe: `EditarModeloForm` (nome + dias sugeridos), `ItensDoModelo` (lista de itens com resumo de prescrição, mover ▲/▼, remover, formulário de adicionar exercício a partir do catálogo unificado da FIT-023), card "Ciclo de vida" (arquivar/reativar).
- `src/app/painel/navigation.ts`: item "Treinos" deixa de ser "Em breve" e passa a apontar para `/painel/treinos`.

## Testes (FIT-030)

- `src/modules/workouts/workouts.integration.test.ts` (Postgres real, 17 testes): criação sempre com `tenantId` da sessão/`status: ATIVO`, no plano rascunho do tenant; listagem exclui arquivado; edição preservando `tenantId`/`trainingPlanId`; isolamento cruzado (nunca retorna `Workout` de outro tenant); arquivamento/reativação idempotentes sem exclusão física; item aceita exercício global ou próprio do tenant, rejeita exercício próprio de outro tenant (`EXERCICIO_INVALIDO`) e modelo de outro tenant (`NAO_ENCONTRADO`); validação de parâmetros de prescrição (inteiro positivo); remoção fecha o buraco de posição; edição de item limpa campo com `null`/string vazia; reordenação aplica a nova ordem e rejeita lista que não corresponde exatamente aos itens existentes; TRIGGER de imutabilidade de snapshot rejeita INSERT/UPDATE/DELETE em `workouts`/`workout_exercises` de um plano `isSnapshot: true`, e o próprio flag nunca volta a `false`.
- Rotas (`src/app/api/workouts/**/*.test.ts`, 27 testes) e páginas (`src/app/painel/treinos/**/*.test.tsx`, 11 testes): 401 sem sessão, 403 quando o autenticado é aluno, `tenantId` do corpo/query nunca repassado, 404 quando o recurso não pertence ao tenant da sessão, 400 em validação.

**Nota operacional descoberta durante os testes**: como o TRIGGER de imutabilidade de snapshot rejeita `DELETE` mesmo quando disparado por `ON DELETE CASCADE`, a limpeza de dados sintéticos de um teste que cria um snapshot (`isSnapshot: true`) precisa desabilitar os dois TRIGGERs de imutabilidade antes de remover as linhas (privilégio de dono da tabela — `ALTER TABLE ... DISABLE/ENABLE TRIGGER`, não exige superusuário; `SET session_replication_role` foi tentado primeiro e rejeitado por falta de permissão). Ver o padrão exato no `afterAll` de `workouts.integration.test.ts` — mesma técnica a reaproveitar em qualquer futuro teste/script que crie um snapshot real (a partir da FIT-033).
