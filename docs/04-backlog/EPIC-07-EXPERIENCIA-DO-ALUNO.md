# EPIC-07 — Experiência do Aluno

Issue: #60.

## Resultado esperado

Sobre a atribuição de plano entregue pela EPIC-06 (SPRINT-07), transformar a consulta passiva do aluno em uma experiência mobile-first de execução e histórico: visualizar o treino do dia orientado ao próximo treino previsto, registrar a sessão executada (séries, temporizador de descanso, conclusão/abandono), e permitir que o personal registre avaliações (peso, medidas, observações) com histórico cronológico consultável pelo aluno. É a Fase 4 do roadmap (`docs/00-governanca/ROADMAP.md`, "Experiência do aluno").

## Histórias

### FIT-040 (#61) — Treino do aluno

Como aluno, quero ver na tela "Hoje" o treino do dia orientado ao próximo treino previsto, com os exercícios na ordem prescrita e seus parâmetros/instruções, para saber exatamente o que fazer sem precisar navegar.

### FIT-041 (#62) — Registrar sessão

Como aluno, quero iniciar, continuar, concluir ou abandonar a execução do treino do dia, registrando os resultados de cada série, para que meu histórico reflita o que eu de fato executei.

### FIT-042 (#63) — Avaliação e evolução básica

Como personal, quero registrar peso, medidas permitidas e observações do aluno, para acompanhar sua evolução; como aluno, quero consultar meu próprio histórico de evolução.

## Dependências

EPIC-06 — Treinos e Planos (#51), concluído: `PlanAssignment` sempre referencia uma cópia imutável (`isSnapshot`) do plano atribuído (ADR-005) — esta Épico lê e executa sobre essa cópia, nunca sobre o plano editável do personal. `WorkoutSession`/`Assessment` (`tenantId` sempre por FK composta) já existem desde a FIT-007 (`prisma/migrations/20260916000000_add_tenant_composite_constraints`) — esta Épico estende esse modelo com campos aditivos, nunca o substitui.

Nota de numeração: `docs/04-backlog/BACKLOG-MVP.md` também lista `FIT-002` na Fase 4 do roadmap original — já implementado e superado pelas Histórias formais FIT-009/010/011/012 (ver a nota explícita no próprio backlog), não reutilizado aqui. `FIT-040` a `FIT-042` já estavam reservados em `docs/04-backlog/BACKLOG-MVP.md` ("Épico 5 — Execução e evolução") e nunca haviam sido promovidos a Issue — usados exatamente como estão, sem renumeração.

## Escopo

- treino do dia (`Workout` da cópia snapshot atribuída): exercícios na ordem prescrita, parâmetros e instruções, estados sem plano/encerrado/descanso/treino do dia;
- sessão de execução (`WorkoutSession`): iniciar, continuar, concluir, abandonar; resultado por item executado; temporizador de descanso; prevenção de dupla submissão; tratamento de falha de conexão;
- avaliação (`Assessment`): peso, medidas permitidas, observações; histórico cronológico; autoria e timestamp preservados.

## Fora do escopo

- sincronização offline (execução exige conexão, com mensagem de falha e nova tentativa, nunca uma promessa de funcionamento sem rede);
- RPE/RIR e vídeo de execução (pós-MVP, mesma decisão já tomada na EPIC-06);
- agenda/calendário formal de treinos (o MVP usa dias sugeridos por modelo, não um motor de agendamento);
- avaliação assistida por IA ou fotos de evolução (pós-MVP);
- qualquer feature de Financeiro/Painel Operacional/Consolidação (Fases 5/6).

## Decisões de modelagem herdadas de `docs/01-produto/REGRAS-DE-NEGOCIO.md` (não negociáveis)

Seção 6 — Sessões:
- "Estados: `planejada`, `em_andamento`, `concluida` e `abandonada`." — já representados em `WorkoutSessionStatus` desde a FIT-007, sem uso até agora.
- "Uma sessão concluída registra data, duração e itens executados."
- "O aluno pode informar valores executados diferentes dos prescritos."
- "O histórico de execução não pode ser recalculado após mudança do plano." — mesma filosofia da ADR-005: a sessão referencia o `Workout`/`WorkoutExercise` do snapshot vigente no momento em que foi iniciada, nunca recalculado se o aluno for reatribuído a outro plano depois.

Seção 7 — Avaliações:
- "Toda avaliação deve registrar data e autor." — já coberto por `Assessment.recordedAt`/`authorUserId` desde a FIT-007.
- "Peso e medidas não podem aceitar valores negativos."
- "Fotografias são opcionais e exigem autorização explícita do aluno." — fora do escopo desta Épico: `FIT-042`/`04_SPRINT_08_EXPERIENCIA_ALUNO.md` não pedem fotografia, e implementar o fluxo de autorização explícita sem um pedido de produto para a feature em si seria especulativo; registrado aqui para não ser confundido com um esquecimento.
- "Exclusões de avaliações devem ser lógicas e auditáveis." — nenhuma exclusão física de `Assessment`, mesmo padrão de arquivamento já usado em `Workout`/`TrainingPlan`/`Exercise`/`Student`.

Seção 9 — Auditoria:
- "Registrar autor, data e tipo de alteração em plano atribuído, avaliação e pagamento." — `AuditEvent` (mesmo padrão já usado em `Student`/`PlanAssignment`).

## Critérios de sucesso do Épico

- aluno vê o treino do dia real, com os quatro estados honestos (sem plano/encerrado/descanso/treino do dia);
- aluno registra a execução de uma sessão (início ao fim ou abandono) sem duplicar resultados mesmo com duplo clique;
- sessão preserva o plano vigente no momento da execução, comprovado por teste real (reatribuir um novo plano depois não altera sessões já registradas);
- personal registra avaliação e o aluno consulta a própria evolução, nunca a de outro aluno;
- isolamento entre tenants/alunos comprovado por testes negativos reais em toda operação nova;
- nenhuma credencial ou dado real versionado;
- nenhuma feature de Fase 5/6 (financeiro, consolidação) implementada.

## Sequenciamento

FIT-040 → FIT-041 → FIT-042 → fechamento da SPRINT-08. A partir da SPRINT-07 (pacote de execução integral, ver `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`), cada História é um checkpoint na branch única `feat/conclusao-integral-mvp` — sem PR nem merge intermediário, sem pausa entre Histórias.
