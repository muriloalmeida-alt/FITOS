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
