# EPIC-06 — Treinos e Planos

Issue: #51.

## Resultado esperado

Sobre o catálogo de exercícios entregue pela EPIC-05 (SPRINT-06), dar ao personal a capacidade de montar modelos de treino reutilizáveis, agrupá-los em planos semanais e atribuir esses planos aos próprios alunos — com a prescrição preservada como uma versão imutável a partir do momento em que é atribuída, mesmo que o modelo original seja editado depois. É a Fase 3 do roadmap (`docs/00-governanca/ROADMAP.md`, "Treinos e planos").

## Histórias

### FIT-030 (#52) — Criar modelo de treino

Como personal, quero montar um modelo de treino com exercícios ordenados e seus parâmetros de prescrição, para reutilizá-lo na montagem de planos.

### FIT-031 (#53) — Duplicar modelo

Como personal, quero duplicar um modelo de treino existente, para criar uma variação sem refazer a montagem do zero e sem afetar o original.

### FIT-032 (#54) — Criar plano semanal

Como personal, quero agrupar modelos de treino em um plano com dias sugeridos e vigência, para organizar a semana de treino de um aluno antes de atribuí-la.

### FIT-033 (#55) — Atribuir plano ao aluno

Como personal, quero atribuir um plano a um aluno preservando a prescrição vigente naquele momento, para que edições futuras no modelo original nunca alterem o que já foi atribuído — e para que o aluno visualize o próprio plano atribuído.

## Dependências

EPIC-05 — Exercícios e Catálogo (#41), concluído: `main` contém o catálogo de exercícios (global + próprio) consultável pelo tenant da sessão. `TrainingPlan`, `Workout`, `WorkoutExercise` e `PlanAssignment` (`tenantId` sempre por FK composta) já existem desde a FIT-007 (`prisma/migrations/20260916000000_add_tenant_composite_constraints`) — esta Épico estende esse modelo com campos aditivos e uma nova regra de imutabilidade pós-atribuição, nunca o substitui.

## Escopo

- modelo de treino (`Workout`): exercícios ordenados, cada um com parâmetros de prescrição (séries, repetições ou duração, carga, descanso, observação); criação, edição, arquivamento;
- duplicação de modelo: cópia independente, nunca um vínculo vivo com o original;
- plano semanal (`TrainingPlan`): agrupa modelos com dias sugeridos e uma vigência sugerida (duração em semanas); criação, edição, arquivamento;
- atribuição (`PlanAssignment`): cria uma cópia imutável (modelo + plano + itens) no momento da atribuição; no máximo uma atribuição ativa por aluno; atribuir um novo plano encerra a atribuição ativa anterior; aluno visualiza o próprio plano atribuído (leitura).

## Fora do escopo

- execução de treino pelo aluno (registrar série, temporizador, sessão) — Fase 4 do roadmap (FIT-002/040/041/042), depende de `WorkoutSession`, já modelado mas não implementado nesta Épico;
- criação de rascunho assistida por IA (pós-MVP, Gate G5 do roadmap);
- RPE/RIR e vídeo de execução (pós-MVP, fora do MVP conforme `ROADMAP.md`);
- múltiplos planos principais ativos simultâneos por aluno (regra do MVP: no máximo um);
- fluxo formal de "rascunho/publicado" (`salvar e publicar`) mencionado em `CRITICAL-SCREEN-SPECS.md` — o MVP entrega salvar/editar direto, sem estado intermediário de publicação; ver nota de escopo em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md`.

## Decisões de modelagem herdadas de `docs/01-produto/REGRAS-DE-NEGOCIO.md` (não negociáveis)

- "A atribuição cria uma versão imutável da prescrição vigente naquele momento."
- "Alterar o modelo original não altera planos já atribuídos."
- "Mudanças em plano ativo geram uma nova versão, preservando o histórico."
- "Um aluno pode ter apenas um plano principal ativo por vez no MVP."
- "Duplicar um modelo cria uma nova entidade sem vínculo de atualização automática."

A decisão técnica de como essas regras são implementadas (cópia física completa no momento da atribuição, com um trigger de imutabilidade análogo ao já existente para `Exercise`) está em `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md` e no ADR correspondente.

## Critérios de sucesso do Épico

- personal monta, edita e arquiva modelos de treino com exercícios ordenados e prescrição — nunca exclusão física;
- duplicar um modelo produz uma cópia realmente independente (editar a cópia nunca afeta o original, e vice-versa);
- personal agrupa modelos em um plano semanal com dias sugeridos e vigência sugerida;
- atribuir um plano a um aluno preserva uma cópia imutável — comprovado por teste real (editar o modelo original depois de atribuído não altera a atribuição já existente);
- no máximo uma atribuição ativa por aluno, imposto fisicamente (não só por checagem de aplicação);
- aluno visualiza o próprio plano atribuído, somente leitura, sem execução/registro de série;
- isolamento entre tenants comprovado por testes negativos reais em toda operação nova;
- nenhuma feature de Fase 4/5/6 (execução, financeiro, consolidação) implementada.

## Sequenciamento obrigatório

FIT-030 → (merge) → FIT-031 → (merge) → FIT-032 → (merge) → FIT-033 → (merge) → fechamento da SPRINT-07. Execução autônoma integral autorizada pelo Produto (mesmo modelo da SPRINT-06) — merge de cada PR ocorre após critérios de aceite e quality gates cumpridos e registrados no próprio PR, sem pausa intermediária entre Histórias.
