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

## Histórias

- FIT-030 (#52) — Criar modelo de treino.
- FIT-031 (#53) — Duplicar modelo.
- FIT-032 (#54) — Criar plano semanal.
- FIT-033 (#55) — Atribuir plano ao aluno. Encerra a SPRINT-07.

## Sequenciamento obrigatório

1. FIT-030 é implementada e submetida a PR (inclui a formalização de SPRINT-07/EPIC-06, o desenho de versionamento/imutabilidade e o documento de arquitetura neste mesmo PR).
2. Gate autônomo aprova; merge por SHA exato.
3. Somente após o merge, FIT-031 inicia automaticamente.
4. FIT-031 é implementada e submetida a PR.
5. Gate autônomo aprova; merge por SHA exato.
6. Somente após o merge, FIT-032 inicia automaticamente.
7. FIT-032 é implementada e submetida a PR.
8. Gate autônomo aprova; merge por SHA exato.
9. Somente após o merge, FIT-033 inicia automaticamente.
10. FIT-033 é implementada e submetida a PR, incluindo o fechamento documental da SPRINT-07.
11. Gate autônomo aprova; merge por SHA exato. Sprint encerrada.

## Critérios de sucesso da Sprint

- personal monta, edita e arquiva modelos de treino com exercícios ordenados e prescrição — nunca exclusão física;
- duplicar um modelo produz uma cópia realmente independente;
- personal agrupa modelos em um plano semanal com dias sugeridos e vigência sugerida;
- atribuir um plano a um aluno preserva uma cópia imutável, comprovada por teste real;
- no máximo uma atribuição ativa por aluno, imposto fisicamente;
- aluno visualiza o próprio plano atribuído, somente leitura;
- isolamento entre tenants comprovado por testes negativos reais em toda operação nova;
- nenhuma credencial ou dado real versionado;
- cada História possui PR próprio, gate autônomo registrado e merge explicitamente por SHA exato.

## Não incluído

- execução de treino pelo aluno (registrar série, temporizador, sessão) — Fase 4 do roadmap;
- criação de rascunho assistida por IA (pós-MVP);
- RPE/RIR e vídeo de execução (fora do MVP);
- fluxo formal de "rascunho/publicado" — salvar/editar direto, sem estado intermediário;
- qualquer feature de Financeiro/Agenda/Mensagens/Consolidação (Fases 5/6).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/PR/merge autorizado permanece a única salvaguarda efetiva.

## Fechamento

Reservado para o PR da FIT-033, conforme a regra desta Sprint de não criar PRs exclusivamente documentais.
