# SPRINT-07 — Treinos e Planos

Status: em andamento — execução autônoma integral autorizada pelo Produto (mesmo modelo da SPRINT-06).

## Objetivo

Dar ao personal a capacidade de montar modelos de treino reutilizáveis, agrupá-los em planos semanais e atribuí-los aos próprios alunos, com a prescrição preservada como uma versão imutável a partir da atribuição. É a Fase 3 do roadmap.

## Épico

- EPIC-06 — Treinos e Planos (#51, `docs/04-backlog/EPIC-06-TREINOS-E-PLANOS.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `main` sincronizada, no commit `15c1b1ba2a9edb3e0eca5cd7ea16ca2a310c2e77` — SPRINT-06 concluída, com a pendência de importação real da API Ninjas declarada explicitamente no fechamento (não bloqueia esta Sprint, que não depende de exercícios importados — exercícios próprios já são suficientes para montar um modelo de treino).
- `TrainingPlan`, `Workout`, `WorkoutExercise` e `PlanAssignment` (FKs compostas por `tenantId`, `WorkoutSession` já modelado para a Fase 4) já existem desde a FIT-007 (`prisma/migrations/20260916000000_add_tenant_composite_constraints`) — esta Sprint estende esse modelo com campos aditivos, nunca o substitui nem edita a migration original.
- Nenhum identificador colidindo: `FIT-030` a `FIT-033` já estavam reservados em `docs/04-backlog/BACKLOG-MVP.md` ("Épico 4 — Treinos e planos") e nunca foram promovidos a Issue — usados exatamente como estão, sem renumeração.
- Nenhum PR aberto conflitante.

## Autorização de execução

Autorização integral concedida pelo Produto para formalizar, implementar, testar, documentar e mergear as quatro Histórias em sequência, sem aprovação intermediária por PR — a única exigência contínua é que cada merge só ocorra após os critérios de aceite e os quality gates da própria História serem cumpridos, com o resultado do gate autônomo registrado no PR antes do merge.

## Escopo confirmado com o Produto antes do início

Duas perguntas foram feitas e respondidas antes de qualquer código: (1) SPRINT-07 é a Fase 3 do roadmap — Treinos e Planos, EPIC-06, FIT-030 a FIT-033 — confirmado; (2) mesma autorização integral de execução e merge autônomo da SPRINT-06, sem aprovação intermediária por PR — confirmado.

## Governança a partir de 20/09/2026

Murilo enviou um pacote único de execução integral (`PROMPT_MESTRE.md` e arquivos anexos, ver `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`) que substitui o modelo de "uma PR/merge por História" por uma única branch de programa (`feat/conclusao-integral-mvp`), com commits/checkpoints por História, sem PR nem merge intermediário, até um único PR final revisado por GPT/Codex. FIT-030 e FIT-031 já estavam mergeadas antes desse pacote (modelo antigo, preservado abaixo como registro histórico); FIT-032 em diante seguem o novo modelo — ver o diário de execução para os checkpoints e o gate final.

## Histórias

- FIT-030 (#52) — Criar modelo de treino. **Concluída** (PR #56, mergeado no commit `1f2f0aa76c47bdbd3b3ab6ebb6e89d5bf7867b69`).
- FIT-031 (#53) — Duplicar modelo. **Concluída** (PR #58, mergeado no commit `836414428994c6e720d89122ccf481d3e7f8b9fd`).
- FIT-032 (#54) — Criar plano semanal. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — commit `d0b39f7`, ver diário de execução).
- FIT-033 (#55) — Atribuir plano ao aluno. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — ver diário de execução para o commit exato). Encerra a SPRINT-07.

## Resultado intermediário — FIT-030

- migration aditiva `20260917000000_add_workout_prescription_and_status`: parâmetros de prescrição em `WorkoutExercise`, `status` em `Workout`/`TrainingPlan`, `suggestedDays`/`durationWeeks`/`isSnapshot` — testada em banco vazio e como atualização do schema atual; TRIGGERs de imutabilidade de snapshot (ADR-005) criados e testados isoladamente nesta História;
- `src/modules/workouts/workouts.ts`: CRUD completo de modelo de treino e de itens (adicionar/editar/remover/reordenar), sempre `tenantId` da sessão, exercício sempre do catálogo visível ao tenant;
- páginas `/painel/treinos` (lista, criação, detalhe) — item "Treinos" da navegação deixa de ser "Em breve";
- decisão documentada em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md` e `adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md`.

## Resultado intermediário — FIT-031

- `cloneWorkoutWithItems` (motor de clonagem compartilhado, reaproveitado pela FIT-033) + `duplicateWorkout`: cópia independente de um modelo (nome, dias sugeridos, todos os itens na mesma ordem), nome com sufixo `" (cópia)"`, nenhuma FK com o original;
- testado explicitamente nas duas direções: editar a cópia não afeta o original, editar o original não afeta a cópia;
- nenhuma migration nesta História;
- decisão documentada em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md`.

## Resultado intermediário — FIT-032

- CRUD real de plano semanal (`createTrainingPlan`/`getTrainingPlanForTenant`/`listTrainingPlansForTenant`/`updateTrainingPlan`/`archiveTrainingPlan`/`reactivateTrainingPlan`), nunca alcançando um plano snapshot;
- `moveWorkoutToPlan`/`removeWorkoutFromPlan`/`listWorkoutsInPlan`/`listWorkoutsAvailableForPlan`/`reorderWorkoutsInPlan`: "adicionar"/"remover" modelo do plano é, por construção, mover (Workout continua pertencendo a exatamente um TrainingPlan);
- páginas `/painel/treinos/planos` (lista, criação, detalhe com gestão de modelos agrupados) e sub-navegação "Modelos"/"Programas";
- **bug real encontrado e corrigido durante a captura de evidência**: o plano rascunho implícito era identificado por heurística (primeiro `TrainingPlan` por `createdAt`), que quebraria se o personal criasse um plano real antes de qualquer modelo avulso — corrigido com a migration aditiva `20260920000000_add_training_plan_draft_bucket` (`TrainingPlan.isDraftBucket`, identificação explícita, índice único parcial garantindo no máximo um por tenant) e dois testes de regressão;
- gate preliminar do pacote de execução integral (auditoria FIT-020 a FIT-023) executado — nenhuma reimplementação necessária, pendência de importação real mantida exatamente como declarada na SPRINT-06;
- decisão documentada em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md`.

## Resultado intermediário — FIT-033

- migration aditiva `20260920010000_add_plan_assignment_lifecycle`: `PlanAssignment.endedAt` + índice único parcial `plan_assignments_active_per_student_key` em `(studentId, tenantId) WHERE active = true` — testada em banco vazio e como atualização do schema atual;
- `assignTrainingPlanToStudent`: encerra controladamente a atribuição ativa anterior do aluno (se houver), clona o plano inteiro (todos os modelos ATIVOS, na mesma ordem, com seus itens) para um `TrainingPlan` novo, marca `isSnapshot: true` só como último passo da transação, cria a `PlanAssignment` e registra `AuditEvent` — materializa a ADR-005, que as três Histórias anteriores prepararam sem usar de fato;
- `unassignTrainingPlanFromStudent`/`getActivePlanAssignmentForStudent`/`listEndedPlanAssignmentsForStudent`: encerramento sem substituir, leitura da atribuição ativa com o snapshot completo, e histórico de atribuições encerradas;
- card "Programa de treino" na ficha do aluno (personal atribui/troca/encerra) e página `/painel/treino` (aluno visualiza, somente leitura) — item "Treino" da navegação do aluno deixa de ser "Em breve";
- imutabilidade comprovada por teste real (editar o modelo original depois da atribuição não altera o que o aluno vê) e por evidência visual (`docs/06-engenharia/evidencias/FIT-033/README.md`);
- decisão documentada em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md` e `adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md` (nome real de função corrigido de `buildDeepClone`, prospectivo, para `cloneWorkoutRows`, o nome de fato implementado).

## Sequenciamento obrigatório

Histórico (modelo anterior ao pacote de execução integral de 20/09/2026, efetivamente seguido por FIT-030 e FIT-031):

1. FIT-030 é implementada e submetida a PR (inclui a formalização de SPRINT-07/EPIC-06, o desenho de versionamento/imutabilidade e o documento de arquitetura neste mesmo PR).
2. Gate autônomo aprova; merge por SHA exato.
3. Somente após o merge, FIT-031 inicia automaticamente.
4. FIT-031 é implementada e submetida a PR.
5. Gate autônomo aprova; merge por SHA exato.

A partir da FIT-032 (pacote de execução integral, `PROMPT_MESTRE.md`): sem PR nem merge intermediário. FIT-032 e FIT-033 são implementadas em sequência na branch única `feat/conclusao-integral-mvp`, cada uma com seu próprio commit/checkpoint e gate autônomo registrado no diário de execução (`docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`). O fechamento documental da SPRINT-07 acontece no checkpoint da FIT-033. A Sprint só é considerada encerrada de fato após a aprovação do PR final do programa por GPT/Codex — os checkpoints internos autorizam Claude a continuar, não equivalem a essa aprovação.

## Critérios de sucesso da Sprint

- personal monta, edita e arquiva modelos de treino com exercícios ordenados e prescrição — nunca exclusão física;
- duplicar um modelo produz uma cópia realmente independente;
- personal agrupa modelos em um plano semanal com dias sugeridos e vigência sugerida;
- atribuir um plano a um aluno preserva uma cópia imutável, comprovada por teste real;
- no máximo uma atribuição ativa por aluno, imposto fisicamente;
- aluno visualiza o próprio plano atribuído, somente leitura;
- isolamento entre tenants comprovado por testes negativos reais em toda operação nova;
- nenhuma credencial ou dado real versionado;
- cada História possui gate autônomo registrado — por PR próprio e merge por SHA exato (FIT-030/031, modelo histórico) ou por checkpoint na branch única do programa de execução integral (FIT-032/033, ver "Governança a partir de 20/09/2026" acima).

## Não incluído

- execução de treino pelo aluno (registrar série, temporizador, sessão) — Fase 4 do roadmap;
- criação de rascunho assistida por IA (pós-MVP);
- RPE/RIR e vídeo de execução (fora do MVP);
- fluxo formal de "rascunho/publicado" — salvar/editar direto, sem estado intermediário;
- qualquer feature de Financeiro/Agenda/Mensagens/Consolidação (Fases 5/6).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/PR/merge autorizado permanece a única salvaguarda efetiva.

## Fechamento

Reservado para o checkpoint da FIT-033, incluído no PR final único do programa de execução integral (`feat/conclusao-integral-mvp`) — nenhum PR exclusivamente documental, mesma regra de sempre, agora aplicada ao programa inteiro em vez de a esta Sprint isoladamente.
