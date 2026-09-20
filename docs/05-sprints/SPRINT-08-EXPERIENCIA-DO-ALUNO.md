# SPRINT-08 — Experiência do Aluno

Status: em andamento — checkpoint por História na branch única `feat/conclusao-integral-mvp` (governança do pacote de execução integral, ver `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`); sem PR nem merge intermediário. A Sprint só é considerada encerrada de fato após a aprovação do PR final do programa por GPT/Codex — os checkpoints internos autorizam a continuação, não equivalem a essa aprovação.

## Objetivo

Transformar a consulta passiva do aluno (FIT-033: só visualizar o plano atribuído) em uma experiência mobile-first de execução e histórico: treino do dia, registro de sessão executada com temporizador, e avaliação/evolução básica registrada pelo personal. Sem sincronização offline e sem RPE/RIR. É a Fase 4 do roadmap.

## Épico

- EPIC-07 — Experiência do Aluno (#60, `docs/04-backlog/EPIC-07-EXPERIENCIA-DO-ALUNO.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `feat/conclusao-integral-mvp` no commit `08d4f5a` — SPRINT-07 concluída (FIT-030 a FIT-033), `PlanAssignment` sempre referenciando uma cópia imutável do plano atribuído (ADR-005).
- `WorkoutSession` (`WorkoutSessionStatus`: `PLANEJADA`/`EM_ANDAMENTO`/`CONCLUIDA`/`ABANDONADA`) e `Assessment` já existem desde a FIT-007 — esta Sprint estende esse modelo com campos aditivos, nunca o substitui.
- Nenhum identificador colidindo: `FIT-040` a `FIT-042` já estavam reservados em `docs/04-backlog/BACKLOG-MVP.md` ("Épico 5 — Execução e evolução") e nunca haviam sido promovidos a Issue — usados exatamente como estão, sem renumeração. `FIT-002` (também listado na Fase 4 do roadmap original) já foi implementado e superado pela FIT-009/010/011/012 — não reutilizado.
- Nenhuma Issue/PR conflitante.

## Histórias

- FIT-040 (#61) — Treino do aluno. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — commit `f51c91d`).
- FIT-041 (#62) — Registrar sessão. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — ver diário de execução para o commit exato).
- FIT-042 (#63) — Avaliação e evolução básica. Encerra a SPRINT-08.

## Resultado intermediário — FIT-040

- `getTodayScheduleForStudent` (`src/modules/workouts/workouts.ts`): deriva os quatro estados da tela "Hoje" (`SEM_PLANO`/`PLANO_ENCERRADO`/`DESCANSO`/`TREINO_HOJE`) a partir da atribuição ativa (FIT-033) — leitura pura, nenhuma escrita, isolamento por tenant/aluno herdado das funções que já o garantiam;
- card "Treino de hoje" em `AlunoHome.tsx` (`/painel`) substitui o placeholder "em breve" da FIT-016 — exercícios, prescrição e instruções (`Exercise.instructions`, existente desde a FIT-021/022, nunca lido por nenhuma tela até agora);
- nenhuma migration — reaproveita `Workout.suggestedDays` (FIT-030) e a atribuição ativa (FIT-033);
- decisão de design registrada (algoritmo de "hoje") em `docs/06-engenharia/arquitetura/EXPERIENCIA-DO-ALUNO.md` e no diário de execução.

## Resultado intermediário — FIT-041

- migration aditiva `20260920020000_add_workout_session_results`: `WorkoutSession.startedAt`/`endedAt` (substitui `occurredAt`, nunca usado), nova tabela `WorkoutSessionResult`, índices únicos aditivos em `workout_exercises`/`workout_sessions` (necessários para a FK composta), e o índice único parcial `workout_sessions_in_progress_per_student_key` (no máximo uma sessão em andamento por aluno);
- `src/modules/execution/sessions.ts` (módulo reservado desde a FIT-007, primeira implementação): `startOrResumeWorkoutSession` (iniciar/continuar são a mesma função; abandona automaticamente a sessão em andamento de outro treino), `recordSessionResult` (upsert — defesa física contra dupla submissão), `completeWorkoutSession`/`abandonWorkoutSession`, `getInProgressSessionForStudent`/`getSessionForStudent`;
- `/painel/treino/sessao`: retoma sessão em andamento, ou mostra "Começar treino" para o treino de hoje, ou um dos três estados honestos; `SessaoExecucao.tsx` com o temporizador de descanso acessível (`aria-live`) e não bloqueante, "Repetir prescrito", e tratamento de falha de conexão (fetch em `try/catch`, mensagem + nova tentativa);
- card "Treino de hoje" (`/painel`, FIT-040) ganha o link "Começar treino"/"Continuar treino em andamento";
- decisões de escopo registradas (nenhum `AuditEvent` para sessão; `PLANEJADA` nunca produzido; "repetir prescrito" como leitura de "repetir último valor") em `docs/06-engenharia/arquitetura/EXPERIENCIA-DO-ALUNO.md`.

## Sequenciamento

FIT-040 → FIT-041 → FIT-042, cada uma com seu próprio commit/checkpoint na branch única, gate autônomo registrado no diário de execução (`docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`). O fechamento documental da SPRINT-08 acontece no checkpoint da FIT-042.

## Critérios de sucesso da Sprint

- aluno vê o treino do dia real, com os quatro estados honestos (sem plano/encerrado/descanso/treino do dia);
- aluno registra a execução de uma sessão (início ao fim ou abandono) sem duplicar resultados mesmo com duplo clique;
- sessão preserva o plano vigente no momento da execução, comprovado por teste real;
- temporizador de descanso acessível e não bloqueante;
- falha de conexão tratada com mensagem e nova tentativa, nunca uma promessa de funcionamento offline;
- personal registra avaliação (peso, medidas, observações) e o aluno consulta a própria evolução, nunca a de outro aluno;
- gráfico de evolução com equivalente textual/tabela;
- isolamento entre tenants/alunos comprovado por testes negativos reais em toda operação nova;
- nenhuma credencial ou dado real versionado;
- cada História possui gate autônomo registrado no diário de execução, checkpoint por commit (não por PR).

## Não incluído

- sincronização offline (execução exige conexão);
- RPE/RIR e vídeo de execução (pós-MVP);
- agenda/calendário formal de treinos;
- fotografias de avaliação (regra existe em `REGRAS-DE-NEGOCIO.md` — "fotografias são opcionais e exigem autorização explícita" — mas nenhuma História desta Sprint pede a feature; implementá-la sem um pedido de produto para o fluxo de autorização seria especulativo);
- avaliação assistida por IA;
- qualquer feature de Financeiro/Painel Operacional/Consolidação (Fases 5/6).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/checkpoint permanece a única salvaguarda efetiva.

## Fechamento

Reservado para o checkpoint da FIT-042, incluído no PR final único do programa de execução integral (`feat/conclusao-integral-mvp`) — nenhum PR exclusivamente documental.
