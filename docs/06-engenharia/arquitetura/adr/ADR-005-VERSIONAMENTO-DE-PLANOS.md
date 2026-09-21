# ADR-005 — Versionamento de planos por cópia física na atribuição

Status: **Aceito** (FIT-030/FIT-033, EPIC-06/SPRINT-07)
Data: 17 de setembro de 2026

## Contexto

`docs/01-produto/REGRAS-DE-NEGOCIO.md` estabelece regras não negociáveis para a atribuição de um plano a um aluno:

- "A atribuição cria uma versão imutável da prescrição vigente naquele momento."
- "Alterar o modelo original não altera planos já atribuídos."
- "Mudanças em plano ativo geram uma nova versão, preservando o histórico."
- "Um aluno pode ter apenas um plano principal ativo por vez no MVP."

O schema físico (`TrainingPlan`, `Workout`, `WorkoutExercise`, `PlanAssignment`) já existe desde a FIT-007, com `PlanAssignment` guardando apenas uma FK composta para `TrainingPlan` — uma referência viva, não uma cópia. Sem uma decisão explícita, editar o `TrainingPlan`/`Workout` original depois de atribuído alteraria retroativamente o que o aluno já está seguindo, violando a primeira e a segunda regra acima.

## Alternativas consideradas

1. **Referência viva + tabela de versões separada** (ex.: uma tabela `TrainingPlanVersion` guardando um diff ou snapshot serializado em JSON). Rejeitada: reintroduz a necessidade de reconstruir a árvore inteira (plano → treinos → itens) a partir de um formato paralelo, dobra a lógica de leitura (uma para o modelo editável, outra para o snapshot) e não se apoia em nenhuma constraint física do banco — o mesmo tipo de risco que os TRIGGERs de isolamento desta base já existem para evitar.
2. **Congelar o modelo original inteiro após a primeira atribuição** (proibir qualquer edição futura, mesmo para outros alunos). Rejeitada: contradiz "reutilizável" — o personal precisa continuar editando/reaproveitando o mesmo modelo/plano para atribuições futuras a outros alunos, só não pode alterar o que alunos já atribuídos estão seguindo.
3. **Cópia física completa no momento da atribuição** (escolhida): ao atribuir, o FitOS clona `TrainingPlan` + todos os `Workout` + todos os `WorkoutExercise` filhos em linhas novas, marcadas como não editáveis (`isSnapshot = true`), e `PlanAssignment` referencia essa cópia — nunca o original. Editar o original depois nunca toca a cópia, porque são linhas completamente diferentes.

## Decisão

Cópia física completa, com uma flag `isSnapshot` em `TrainingPlan` e um TRIGGER de imutabilidade análogo ao já existente para `Exercise.tenantId` (`enforce_exercise_tenant_immutability`, FIT-007): mesma filosofia desta base — a checagem de aplicação (o módulo de domínio nunca expõe uma rota de edição para um snapshot) é reforçada por uma constraint física que rejeita qualquer `INSERT`/`UPDATE`/`DELETE` em `workouts`/`workout_exercises` cujo `training_plan_id` pertença a um `TrainingPlan` com `isSnapshot = true` — não é uma alternativa à checagem de aplicação, é uma segunda camada.

`cloneWorkoutRows` (`src/modules/workouts/workouts.ts` — motor de baixo nível compartilhado entre a duplicação de modelo da FIT-031, via o envelope `cloneWorkoutWithItems`, e a atribuição da FIT-033, chamado repetidamente dentro da própria transação de `assignTrainingPlanToStudent`) clona `Workout`/`WorkoutExercise` gerando ids novos via `cuid()`; `assignTrainingPlanToStudent` clona também o `TrainingPlan` (uma linha nova, `isSnapshot: false` até o último passo da mesma transação). Nenhuma cópia reaproveita ids do original, nenhum vínculo de FK entre a cópia e a origem (não há necessidade de rastrear proveniência para o MVP; se um dia for necessário auditar "de qual modelo esta atribuição veio", isso ficaria em `AuditEvent`, não em uma FK estrutural).

"Mudanças em plano ativo geram uma nova versão" é resolvida sem nenhum campo de versão numérica: reatribuir (FIT-033) sempre encerra (`active = false`) a atribuição anterior e cria uma nova atribuição com um novo clone — o "histórico" é a sequência de `PlanAssignment` (mais antigas primeiras, cada uma com seu próprio snapshot imutável), não um contador de versão dentro de uma única linha.

"Um aluno pode ter apenas um plano principal ativo por vez" é imposto por um índice único parcial em `plan_assignments`: `(studentId, tenantId) WHERE active = true` — mesmo padrão já usado para duplicidade de nome de exercício próprio (FIT-022) e para o e-mail único por tenant (`Student`).

## Consequências

- Nenhuma edição no modelo/plano original depois de atribuído pode, por construção física, alterar o que um aluno já está seguindo.
- O custo é armazenamento redundante (uma cópia completa por atribuição) — aceitável para o volume esperado do MVP (dezenas de alunos por tenant, não milhares).
- Consultar "o plano atribuído do aluno" (FIT-033, visão do aluno) é uma leitura direta do snapshot, sem nenhuma lógica de "resolver a versão vigente" — simples e sem ambiguidade.
- Uma limitação aceita: se o personal quiser que uma correção no modelo original (ex.: um erro de digitação na descrição) se reflita em atribuições já existentes, isso exige reatribuir explicitamente — não há propagação automática. Comportamento deliberado (é exatamente o que "preserva histórico" exige), documentado aqui para não ser confundido com um defeito.
- **Efeito colateral descoberto durante os testes da FIT-030**: o TRIGGER de imutabilidade rejeita **qualquer** DELETE em `workouts`/`workout_exercises` de um plano snapshot — inclusive o DELETE disparado por `ON DELETE CASCADE` a partir do `Tenant`. Ou seja, a partir do momento em que um tenant tem qualquer atribuição real (snapshot), esse tenant **não pode mais ser removido por cascata** sem primeiro desabilitar os dois TRIGGERs de imutabilidade (privilégio de dono da tabela, não de superusuário — ver a limpeza de dados sintéticos em `workouts.integration.test.ts` para o padrão exato). Nenhum fluxo de produto do MVP exclui um tenant, então isso não é um problema de comportamento hoje — é só uma pegadinha a lembrar em qualquer rotina futura de exclusão de conta/tenant, e em qualquer script de limpeza de dados sintéticos de evidência que envolva um snapshot real (a partir da FIT-033).
