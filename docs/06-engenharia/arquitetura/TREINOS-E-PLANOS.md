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

## FIT-031 — Duplicar modelo

`cloneWorkoutWithItems` (função interna de `workouts.ts`) clona um `Workout` inteiro — nome, dias sugeridos e todos os `WorkoutExercise` na mesma ordem — em uma linha nova dentro de um `TrainingPlan` de destino, com ids novos e nenhuma FK entre a cópia e a origem. `duplicateWorkout` (exportada, FIT-031) é a primeira usuária: chama esse motor com `targetTrainingPlanId` igual ao do próprio modelo e `nameOverride` acrescentando `" (cópia)"` ao nome original.

Este motor é deliberadamente compartilhado: a FIT-033 vai reutilizá-lo (com um `targetTrainingPlanId` diferente — o `TrainingPlan` snapshot recém-criado — e sem o sufixo de cópia) para clonar cada `Workout` de um plano no momento da atribuição, conforme ADR-005. A única validação que `cloneWorkoutWithItems` não faz é se o destino já é um snapshot — se for, o próprio TRIGGER de imutabilidade (FIT-030) rejeita a inserção; nenhuma função deste módulo expõe esse caminho ao personal (a FIT-033 sempre clona para um plano recém-criado, ainda com `isSnapshot: false`, marcando `true` só como último passo — ver ADR-005).

### Rota e UI

`POST /api/workouts/[id]/duplicar` — mesma checagem `requirePersonal()`. Botão "Duplicar modelo" na página de detalhe (`DuplicarModeloButton.tsx`), que navega para o detalhe da cópia recém-criada após o sucesso.

### O que esta História não faz

Nenhuma migration — reaproveita integralmente o schema da FIT-030. Não duplica o plano inteiro (`TrainingPlan`), só o modelo (`Workout`) — duplicar um plano completo, se necessário, é uma extensão natural fora do escopo desta História.

## Testes (FIT-031)

`src/modules/workouts/workouts.integration.test.ts` (4 novos testes): cópia recebe nome com sufixo, mesmo plano do original, dias sugeridos copiados, todos os itens clonados na mesma ordem com os mesmos parâmetros de prescrição; editar a cópia não afeta o original e editar o original não afeta a cópia já criada (teste explícito nas duas direções); duplicar um modelo sem itens produz uma cópia sem itens; duplicar modelo de outro tenant rejeitado (`NAO_ENCONTRADO`). Rota (3 testes) e página (1 asserção nova): mesmo padrão de autorização das demais rotas deste módulo.

## FIT-032 — Plano semanal

`TrainingPlan` já existia desde a FIT-007/FIT-030 (bootstrapping do plano "rascunho" implícito); esta História entrega o CRUD real, exposto ao personal, e a operação de agrupar modelos dentro de um plano.

### Não há um segundo conceito de plano

O plano "rascunho" implícito (`ensureDraftTrainingPlanForTenant`, FIT-030) e os planos reais criados por `createTrainingPlan` (FIT-032) são a **mesma tabela, o mesmo modelo, a mesma regra de negócio** — não uma migração de dado de um sistema para outro. A partir da FIT-032, o personal pode criar outros planos reais, e um modelo pode ser movido entre planos (incluindo entre o rascunho e um plano nomeado) — ver `moveWorkoutToPlan` abaixo. `status` e `durationWeeks` já existiam em `TrainingPlan` desde a migration da FIT-030 (`20260917000000_add_workout_prescription_and_status`), criados propositalmente adiantados para esta História.

### Bug encontrado durante a captura de evidência: identificação do rascunho por heurística

A primeira versão desta História identificava o plano rascunho como "o primeiro `TrainingPlan` não-snapshot criado, por `createdAt`" — sem um campo dedicado. A captura de evidência visual expôs o problema: se o personal cria um plano real (via `/painel/treinos/planos/novo`) *antes* de criar qualquer modelo avulso, esse plano real passa a ser "o primeiro criado" e seria confundido com o rascunho na próxima chamada de `createWorkout` — um modelo avulso cairia silenciosamente dentro do programa nomeado do personal, e o próprio rascunho (renomeado incorretamente) apareceria na listagem de "Programas" como se tivesse sido criado deliberadamente (o que de fato aconteceu na primeira rodada de captura, com "Meus modelos" listado como programa).

Corrigido com a migration aditiva `20260920000000_add_training_plan_draft_bucket`: `TrainingPlan.isDraftBucket Boolean @default(false)`, identificação explícita (nunca heurística), com índice único parcial `training_plans_tenant_draft_bucket_key` em `(tenantId) WHERE isDraftBucket = true` garantindo no máximo um por tenant (mesma técnica dos demais índices únicos parciais já usados neste projeto — FIT-022). `ensureDraftTrainingPlanForTenant` passa a buscar/criar por essa flag; `listTrainingPlansForTenant` passa a excluir `isDraftBucket: true` — o rascunho nunca aparece na listagem voltada ao personal. A mesma migration também limpa o drift de `DEFAULT` físico em `updatedAt` já identificado em migrations anteriores (sem efeito de comportamento).

Dois testes de regressão em `workouts.integration.test.ts` cobrem exatamente o cenário do bug (plano real criado antes de qualquer modelo avulso; listagem nunca inclui o rascunho).

### "Adicionar"/"remover" modelo do plano é, por construção, mover

Como `Workout` sempre pertence a exatamente um `TrainingPlan` (nunca uma relação muitos-para-muitos — ver a seção "Por que 'reutilizável' não é uma relação muitos-para-muitos" acima), `moveWorkoutToPlan` é o único mecanismo de associação: "adicionar ao plano B" reparenta `trainingPlanId` para B, fecha o buraco de posição deixado no plano de origem A e insere na última posição de B. `removeWorkoutFromPlan` é `moveWorkoutToPlan` com o plano de destino fixado no plano rascunho do tenant — o modelo nunca é excluído nem arquivado, só deixa de estar agrupado naquele plano específico.

### Funções (`src/modules/workouts/workouts.ts`)

- `createTrainingPlan`, `getTrainingPlanForTenant`, `listTrainingPlansForTenant`, `updateTrainingPlan`, `archiveTrainingPlan`, `reactivateTrainingPlan` — mesmo padrão de `Workout` (FIT-030): `tenantId` sempre da sessão, nunca payload de cliente; nunca alcançam um plano `isSnapshot: true` (proteção em profundidade — o TRIGGER da ADR-005 seria a rede de segurança física se algo tentasse).
- `listWorkoutsInPlan` — modelos ATIVOS de um plano, em ordem.
- `listWorkoutsAvailableForPlan` — modelos ATIVOS do tenant que não pertencem ao plano informado (candidatos ao picker de "adicionar").
- `moveWorkoutToPlan` — reparenta; no-op se o modelo já está no plano de destino.
- `removeWorkoutFromPlan` — exige que o modelo pertença de fato ao plano informado na chamada (`NAO_ENCONTRADO` caso contrário, mesmo padrão de isolamento das demais funções) antes de mover para o rascunho.
- `reorderWorkoutsInPlan` — mesma validação de conjunto exato de `reorderWorkoutExercises` (FIT-030), agora para os modelos de um plano.

### Páginas (`src/app/painel/treinos/planos/`)

- `page.tsx` — lista de planos ATIVOS do tenant.
- `novo/page.tsx` + `CriarPlanoForm.tsx` — criação (nome obrigatório, vigência sugerida opcional).
- `[id]/page.tsx` — detalhe: `EditarPlanoForm` (nome + vigência), `ModelosDoPrograma` (lista ordenada com mover ▲/▼/remover, picker para adicionar um modelo existente do tenant), card "Ciclo de vida" (arquivar/reativar).
- `TreinosSubNav.tsx` — sub-navegação "Modelos"/"Programas" dentro da seção Treinos, conforme `UX-ARCHITECTURE.md` ("3. Treinos → Programas / Modelos"); adicionada tanto em `/painel/treinos` quanto em `/painel/treinos/planos`.

### O que esta História não faz

Não implementa atribuição ao aluno nem a cópia imutável de fato usada (FIT-033 — o motor `cloneWorkoutWithItems`/o TRIGGER de imutabilidade já existem desde FIT-030/031, prontos para reutilização).

## Testes (FIT-032)

- `src/modules/workouts/workouts.integration.test.ts` (39 novos testes cobrindo FIT-032, entre CRUD de plano e movimentação de modelos): criação sempre `ATIVO`/não-snapshot; isolamento cruzado (plano de outro tenant nunca encontrado); plano snapshot nunca alcançável por `getTrainingPlanForTenant`; edição preservando isolamento; arquivamento/reativação idempotentes, modelos agrupados preservados; `moveWorkoutToPlan` reparenta e fecha buraco de posição na origem; mover para o mesmo plano é no-op; mover modelo/para-plano de outro tenant rejeitado; `listWorkoutsAvailableForPlan` exclui os já pertencentes ao plano; `removeWorkoutFromPlan` move para o rascunho e rejeita quando o modelo não pertence ao plano informado; `reorderWorkoutsInPlan` reordena e rejeita lista incompleta/incorreta; **regressão do bug do plano rascunho** (dois testes): listagem nunca inclui o rascunho mesmo depois de criado, e criar um plano real antes de qualquer modelo avulso não faz esse plano ser confundido com o rascunho.
- Rotas (`src/app/api/training-plans/**/*.test.ts`) e páginas (`src/app/painel/treinos/planos/**/*.test.tsx`): mesmo padrão de autorização/isolamento das demais rotas deste módulo — 401 sem sessão, 403 aluno, `tenantId` do corpo nunca repassado, 404 fora do tenant, 400 em validação.

## FIT-033 — Atribuir plano ao aluno

Última História da SPRINT-07. Materializa a ADR-005 (versionamento por cópia física) que as três Histórias anteriores prepararam: `isSnapshot` (FIT-030), o TRIGGER de imutabilidade (FIT-030) e `cloneWorkoutWithItems` (FIT-031) já existiam prontos para reutilização — esta História é a primeira a de fato criar um `TrainingPlan` com `isSnapshot: true`.

### `PlanAssignment.endedAt` e a unicidade física da atribuição ativa

`PlanAssignment` já existia desde a FIT-007, mas sem `endedAt` — não havia como distinguir "encerrada" de "nunca existiu", nem impor no banco "no máximo uma ativa por aluno" (a aplicação teria que confiar em si mesma). A migration aditiva `20260920010000_add_plan_assignment_lifecycle` adiciona `endedAt DateTime?` (marca o encerramento controlado; `null` enquanto `active`) e o índice único parcial `plan_assignments_active_per_student_key` em `(studentId, tenantId) WHERE active = true` — mesma técnica dos demais índices únicos parciais já usados neste projeto (`exercises_personal_tenant_name_key`, FIT-022; `training_plans_tenant_draft_bucket_key`, FIT-032). Testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).

### `cloneWorkoutRows`: o motor de clonagem ganha uma variante de baixo nível

`cloneWorkoutWithItems` (FIT-031) sempre abria sua própria transação — adequado para duplicar um único modelo, mas insuficiente aqui: atribuir um plano precisa clonar **todos** os modelos ativos do plano, cada um com seus itens, dentro da **mesma** transação que cria o `TrainingPlan` snapshot e a `PlanAssignment`. A função foi dividida em `cloneWorkoutRows(tx, {...})` (aceita o client de uma transação já aberta pelo chamador, sem decidir a posição — responsabilidade de quem chama) e um envelope que preserva o comportamento exato de `duplicateWorkout` (abre sua própria transação, sempre anexa ao final do plano de destino). Nenhum teste da FIT-031 precisou mudar — o comportamento observável é idêntico.

### `assignTrainingPlanToStudent`: uma única transação, cinco passos

1. Encerra controladamente (`active: false`, `endedAt: now()`) qualquer atribuição ativa anterior do mesmo aluno — existe para que a unicidade física (índice único parcial) nunca seja alcançada por exceção, e sim por construção.
2. Cria um `TrainingPlan` novo com `isSnapshot: false` (ainda editável, do ponto de vista do TRIGGER).
3. Clona, na mesma ordem, cada `Workout` ATIVO do plano original (com `cloneWorkoutRows`) para dentro desse plano novo.
4. Marca o plano novo como `isSnapshot: true` — só agora, como **último passo**, porque a mesma transação vê suas próprias escritas ainda não confirmadas (MVCC) e os `INSERT`s dos passos 2–3 nunca são bloqueados pelo TRIGGER (ver o comentário exato disso já registrado na migration da FIT-030).
5. Cria a `PlanAssignment` apontando para o plano snapshot (nunca para o original) e registra um `AuditEvent`.

`unassignTrainingPlanFromStudent` encerra a atribuição ativa sem criar uma nova (idempotente: sem atribuição ativa, retorna `null`, não lança). `getActivePlanAssignmentForStudent` carrega a atribuição ativa com o plano-snapshot, seus modelos e itens já incluídos, ordenados — a visão somente leitura do aluno. `listEndedPlanAssignmentsForStudent` lista o histórico de atribuições encerradas (mais recente primeiro), usado só para distinguir "nunca teve plano" de "teve e foi encerrado" na UI, sem reconstruir o clone completo de um plano que o aluno já não segue.

### Prova de imutabilidade: por que editar o original nunca altera o atribuído

Não é apenas uma garantia física (o TRIGGER da ADR-005 já bloquearia a tentativa) — é um comportamento observável e comprovado por teste real (`workouts.integration.test.ts`, "editar o modelo/plano original depois da atribuição não altera o que foi atribuído") e pela evidência visual (`docs/06-engenharia/evidencias/FIT-033/README.md`, seção "Prova de imutabilidade"): o personal renomeia o modelo original pela UI real, e a visão do aluno permanece bit a bit idêntica, porque `PlanAssignment.trainingPlanId` nunca apontou para o modelo editável — apontou, desde a criação, para a cópia física.

### Superfície de UI

- Personal (`src/app/painel/alunos/[id]/PlanoDoAlunoSection.tsx`, no card "Programa de treino" da ficha do aluno — não na página do plano, porque o plano-origem não tem nenhum vínculo de volta com os snapshots que gerou, então "quem tem este plano atribuído" só pode ser respondido a partir do aluno, nunca a partir do plano): mostra a atribuição ativa (nome, data, "Encerrar atribuição") ou o estado vazio apropriado, e sempre a seção "Atribuir programa"/"Trocar programa" com os planos ATIVOS do tenant.
- Aluno (`src/app/painel/treino/page.tsx`, item "Treino" da navegação deixa de ser "Em breve"): somente leitura — plano, vigência sugerida, modelos e itens com o mesmo resumo de prescrição já usado na visão do personal (FIT-030), ou um dos três estados honestos: nunca atribuído, ativo, ou encerrado (mensagem distinta de "nunca atribuído").
- `POST /api/students/[id]/plano` (atribuir) e `DELETE /api/students/[id]/plano` (encerrar) — mesma checagem `requirePersonal()` das demais rotas deste domínio.

### O que esta História não faz

- Não implementa execução de treino pelo aluno (registrar série, temporizador, sessão) — Fase 4 do roadmap (`WorkoutSession` já modelado desde a FIT-007, não usado por nenhuma função desta História).
- Não valida o `status` do aluno (`ATIVO`/`INATIVO`) na atribuição — nenhuma regra de negócio existente (`REGRAS-DE-NEGOCIO.md`) exige isso, e um aluno inativado já perde acesso à experiência normal por inteiro (`requireStudent`, FIT-011/014), tornando a validação redundante nesta camada.
- Não expõe nenhuma edição em um `TrainingPlan`/`Workout`/`WorkoutExercise` com `isSnapshot: true` — nenhuma rota nova, nenhuma página nova toca esse caminho; a única proteção adicional além do TRIGGER é a própria ausência de UI.

## Testes (FIT-033)

- `src/modules/workouts/workouts.integration.test.ts` (11 novos testes): criação do snapshot com modelos/itens preservados na mesma ordem (ids diferentes do original); editar o modelo/plano original depois da atribuição não altera o que foi atribuído; isolamento cruzado (aluno de outro tenant, plano de outro tenant — ambos `NAO_ENCONTRADO`); encerra controladamente a atribuição anterior ao atribuir um novo plano ao mesmo aluno; unicidade física da atribuição ativa (índice único parcial rejeita um segundo INSERT direto); `unassignTrainingPlanFromStudent` encerra sem substituir e é idempotente; `getActivePlanAssignmentForStudent` retorna `null` sem atribuição; `listEndedPlanAssignmentsForStudent` lista mais recente primeiro; isolamento na leitura da atribuição ativa.
- Rota (`src/app/api/students/[id]/plano/route.test.ts`, 7 testes) e página (`src/app/painel/alunos/[id]/page.test.tsx`, 3 novos casos; novo `src/app/painel/treino/page.test.tsx`, 5 casos): mesmo padrão de autorização/isolamento das demais rotas deste módulo — 401 sem sessão, 403 quando o autenticado não é o papel esperado, 404 fora do tenant, 400 em validação, e os três estados de UI (sem plano/ativo/encerrado) para o personal e para o aluno.
