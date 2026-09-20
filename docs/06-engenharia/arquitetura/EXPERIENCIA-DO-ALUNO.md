# Experiência do aluno (SPRINT-08)

Este documento detalha a implementação da EPIC-07/SPRINT-08 (FIT-040 a FIT-042): treino do dia, registro de sessão e avaliação/evolução. Complementa (não substitui) `docs/01-produto/REGRAS-DE-NEGOCIO.md`, `docs/06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md` e `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md` (de onde esta Épico lê a atribuição ativa).

## FIT-040 — Treino do aluno

A tela "Hoje" do aluno (`/painel`, real desde a FIT-016 — só o vínculo) passa a mostrar o treino do dia de fato, lido a partir da atribuição ativa (`PlanAssignment`, FIT-033) — sempre o plano-snapshot imutável, nunca o plano editável do personal.

### Os quatro estados

`getTodayScheduleForStudent` (`src/modules/workouts/workouts.ts`) deriva um de quatro estados, uma leitura pura sobre `getActivePlanAssignmentForStudent`/`listEndedPlanAssignmentsForStudent` (FIT-033, já garantem isolamento por tenant/aluno):

1. `SEM_PLANO` — o aluno nunca teve nenhuma atribuição.
2. `PLANO_ENCERRADO` — havia atribuição, foi encerrada, nenhuma ativa agora.
3. `DESCANSO` — há atribuição ativa, mas nenhum modelo do plano tem o dia de hoje em `suggestedDays` (inclusive quando nenhum modelo tem nenhum dia configurado).
4. `TREINO_HOJE` — há um modelo, entre os do plano (em ordem de posição), cujo `suggestedDays` inclui o dia de hoje.

### Decisão de design: como "hoje" é determinado

Nem `PROMPT_MESTRE.md`/`04_SPRINT_08_EXPERIENCIA_ALUNO.md` nem `CRITICAL-SCREEN-SPECS.md` especificam o algoritmo exato de "próximo treino" — decisão registrada aqui (e em `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`) para revisão externa. `todayWeekdayLabel` usa o mesmo vocabulário fixo já usado pela UI do personal desde a FIT-030 (`SEGUNDA`/`TERCA`/`QUARTA`/`QUINTA`/`SEXTA`/`SABADO`/`DOMINGO`, sem acento — `EditarModeloForm.tsx`) e `Date.getDay()` do servidor — mesma simplificação de fuso já aceita em `daysUntil` (FIT-015). Se dois modelos do mesmo plano tiverem o mesmo dia configurado, o primeiro por posição vence: limitação aceita, sem pedido de produto para desambiguar (um motor de agendamento completo está fora do escopo do MVP — ver `docs/04-backlog/EPIC-07-EXPERIENCIA-DO-ALUNO.md`, "Fora do escopo"). "Treino futuro", no texto da Issue, é lido literalmente: o treino de hoje ainda não foi executado (não existe registro de sessão até a FIT-041) — não é uma prévia do próximo dia da semana com treino.

### UI (`src/app/painel/AlunoHome.tsx`)

O card "Treino de hoje" substitui o placeholder "em breve" da FIT-016. Reaproveita a mesma lógica de resumo de prescrição já usada em `ItensDoModelo.tsx` (FIT-030) e `/painel/treino/page.tsx` (FIT-033) — duplicada aqui deliberadamente (função pura pequena, sem estado compartilhado) em vez de extraída para um módulo comum; nenhuma das três cópias precisou mudar quando a terceira foi criada. Também exibe `Exercise.instructions` (campo já existente desde a FIT-021/022, nunca lido por nenhuma tela até agora).

### O que esta História não faz

- Não registra execução de sessão (`WorkoutSession`) — FIT-041; a tela é somente leitura, mesmo padrão da FIT-033.
- Não implementa nenhum motor de agendamento/calendário — a "previsão para hoje" é derivada dos dias sugeridos já existentes, nada novo no schema.
- Não altera `/painel/treino` (visão completa do plano, FIT-033) — as duas telas coexistem: "Hoje" é o recorte do dia, "/painel/treino" é o plano inteiro.

## Testes (FIT-040)

- `src/modules/workouts/workouts.integration.test.ts` (6 novos testes): os quatro estados (incluindo o caso de "descanso" com e sem `suggestedDays` configurado em qualquer modelo), o conteúdo completo do treino do dia (exercícios, instruções incluídas por composição do include já existente), e isolamento cruzado (nunca deriva o estado a partir de aluno de outro tenant).
- `src/app/painel/AlunoHome.test.tsx` (5 casos, componente novo de teste dedicado): os quatro estados renderizados corretamente, incluindo o estado vazio honesto "este treino ainda não tem exercícios" para um modelo sem itens.
- `src/app/painel/page.test.tsx` (caso existente atualizado): `getTodayScheduleForStudent` chamado com `tenantId`/`studentId` da sessão, nunca do cliente.

## FIT-041 — Registrar sessão

Materializa `WorkoutSession`/o novo `WorkoutSessionResult` (`src/modules/execution/sessions.ts` — módulo reservado desde a FIT-007, sem implementação até agora, ver `src/modules/execution/README.md`). Toda sessão referencia um `Workout` do plano-snapshot da atribuição ativa no momento em que foi iniciada (ADR-005) — nunca o modelo editável do personal, o que já garante, por construção, "o histórico de execução não pode ser recalculado após mudança do plano" (`REGRAS-DE-NEGOCIO.md`, seção 6).

### Migration aditiva

`prisma/migrations/20260920020000_add_workout_session_results/`:

- `WorkoutSession` perde `occurredAt` (nunca usado — a tabela estava vazia em todos os ambientes) e ganha `startedAt`/`endedAt`; o `status` padrão passa de `PLANEJADA` para `EM_ANDAMENTO` — nenhuma função deste módulo produz `PLANEJADA`, decisão de escopo abaixo.
- `WorkoutSessionResult` (nova tabela): um registro por `WorkoutExercise` por sessão, com `setsCompleted`/`repsCompleted`/`durationSecondsCompleted`/`loadUsed` — independentes dos valores prescritos ("o aluno pode informar valores executados diferentes dos prescritos", mesma seção 6).
- `workout_exercises_id_tenantId_key`/`workout_sessions_id_tenantId_key` (índices únicos aditivos): necessários para que `WorkoutSessionResult` referencie ambos por FK composta com `tenantId`, mesmo padrão de isolamento já usado em todo o schema.
- Índice único parcial `workout_sessions_in_progress_per_student_key` em `(studentId, tenantId) WHERE status = 'EM_ANDAMENTO'` — no máximo uma sessão em andamento por aluno, mesma técnica de `plan_assignments_active_per_student_key` (FIT-033).

### Decisão de escopo: `PLANEJADA` nunca é produzido

`REGRAS-DE-NEGOCIO.md` lista `planejada` como um dos quatro estados de sessão, mas nenhuma História (FIT-040/041) pede um fluxo de "agendar sessão" separado de "iniciar" — o próprio "iniciar" já cria a sessão em `EM_ANDAMENTO`. O valor do enum permanece (é a nomenclatura do produto, preservada para uma eventual Fase futura de agenda), mas construir um fluxo de agendamento sem nenhum pedido de produto para ele seria especulativo.

### `startOrResumeWorkoutSession`: "iniciar" e "continuar" são a mesma função

Retomar uma sessão `EM_ANDAMENTO` do **mesmo** treino é "continuar" (retorna a existente, nunca cria uma segunda). Existir uma sessão `EM_ANDAMENTO` de **outro** treino abandona essa automaticamente antes de criar a nova, na mesma transação — mesmo padrão já usado em `assignTrainingPlanToStudent` (FIT-033) para nunca alcançar a unicidade física por exceção. A página de sessão (`/painel/treino/sessao`) prioriza retomar **qualquer** sessão em andamento antes mesmo de olhar para o treino de hoje — "continuar" é literal, não limitado ao dia calendário atual.

### `recordSessionResult`: upsert como defesa física contra dupla submissão

Um resultado por `[workoutSessionId, workoutExerciseId]` (índice único) — reenviar o mesmo item nunca cria uma segunda linha, apenas substitui os valores. A checagem de `isSubmitting` na UI (desabilitar o botão durante o envio) é a primeira camada, não a única; a física é quem de fato garante o comportamento, mesma filosofia de todo o resto desta base (aplicação + constraint).

### Temporizador de descanso

`DescansoTimer` (dentro de `SessaoExecucao.tsx`): `aria-live="polite"` anuncia a contagem sem exigir foco; "Pular descanso" encerra a qualquer momento; nenhum outro controle da tela é desabilitado enquanto ele conta — não é modal, não bloqueia.

### Falha de conexão

Todo `fetch` da UI de execução está em `try/catch` — além do padrão já estabelecido de checar `response.ok`, uma exceção de rede (offline, DNS, etc.) é capturada e mostra "Falha de conexão. Verifique sua internet e tente novamente.", nunca uma tela quebrada. Nenhum armazenamento local entre sessões de navegador — "sem sincronização offline" é explícito no próprio `PROMPT_MESTRE.md`/`04_SPRINT_08_EXPERIENCIA_ALUNO.md`.

### Sem `AuditEvent`

"Registrar autor, data e tipo de alteração" (`REGRAS-DE-NEGOCIO.md`, seção 9) lista explicitamente "plano atribuído, avaliação e pagamento" — sessão não está nessa lista. Nenhuma função de `sessions.ts` grava `AuditEvent` (decisão registrada, não um esquecimento).

### UI (`src/app/painel/treino/sessao/`)

- `page.tsx`: prioriza retomar sessão em andamento; senão, se há treino previsto para hoje, mostra `ComecarTreinoButton`; senão, um dos três estados honestos (sem plano/encerrado/descanso).
- `SessaoExecucao.tsx`: um card por item, com os campos de resultado, "Repetir prescrito" (copia os valores prescritos em um toque — a leitura adotada para "repetir último valor em um toque quando aplicável", já que a granularidade desta MVP é um resultado por exercício, não por série individual), o temporizador, e "Concluir treino"/"Abandonar treino".
- `src/app/painel/AlunoHome.tsx` (card "Treino de hoje", FIT-040): ganha um link para a sessão — "Começar treino" ou "Continuar treino em andamento" (este último aparece independente do estado do dia, se houver uma sessão em andamento).

### O que esta História não faz

- Não implementa nenhuma tela de histórico de sessões — os dados já existem (`WorkoutSession`/`WorkoutSessionResult`), mas nenhuma Issue desta Sprint pede uma listagem; fica disponível para a "Fase 4" completa ou para a FIT-042 (evolução), se o Produto decidir.
- Não implementa RPE/RIR nem vídeo de execução (pós-MVP, mesma decisão já tomada na EPIC-06).
- Não implementa nenhuma forma de sincronização offline (fora do escopo explícito desta Sprint).

## Testes (FIT-041)

- `src/modules/execution/sessions.integration.test.ts` (16 novos testes, Postgres real): iniciar cria sessão `EM_ANDAMENTO`; retomar o mesmo treino não duplica; abandona automaticamente a sessão de outro treino antes de iniciar a nova; rejeita treino fora do plano atribuído e aluno sem atribuição ativa; unicidade física da sessão em andamento (índice único parcial); registrar resultado cria e depois substitui (nunca duplica); rejeita item de outro treino e registro em sessão já concluída; rejeita valores não positivos; concluir/abandonar definem `endedAt` e rejeitam repetir a ação; abandonar preserva resultados já registrados; isolamento cruzado; histórico preserva o treino vigente mesmo após reatribuição a outro plano.
- Rotas (`src/app/api/workout-sessions/**/*.test.ts`, 16 testes): 401 sem sessão, 403 quando não é aluno, `tenantId`/`studentId` do corpo nunca repassados, 404/400 conforme o erro do domínio.
- Componentes (`ComecarTreinoButton.test.tsx`, 3 casos; `SessaoExecucao.test.tsx`, 9 casos, incluindo o temporizador com `vi.useFakeTimers`): fluxo completo de salvar resultado, "Repetir prescrito", concluir/abandonar navegando para `/painel`, e as mensagens de erro tanto para resposta não-ok quanto para falha de rede (fetch lançando).
- `src/app/painel/treino/sessao/page.test.tsx` (6 casos): os três caminhos da página (retomar, começar, estados honestos).
