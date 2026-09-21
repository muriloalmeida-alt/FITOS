# Painel Operacional (EPIC-09)

## FIT-060 — Consolidar visão operacional

- Nenhuma entidade nova: `PersonalHome.tsx` (placeholder desde a FIT-012) passa a compor três leituras já existentes — `listStudents` (FIT-013, `status: "ATIVO"`, só a contagem via `total`), `listWorkoutsForTenant` (FIT-030, modelos de treino `ATIVO`) e `getFinancialSummary` (FIT-053, competência do mês atual) — nunca um novo módulo ou tabela.
- "Treinos" no painel é a contagem de modelos de treino `ATIVO` (`Workout`), o mesmo conjunto que o item "Treinos" da navegação já lista — não a contagem de planos semanais nem de sessões executadas, já que a navegação existente aponta para essa mesma listagem.
- "Situação financeira" no painel mostra só o indicador que "exige ação" (atrasado do mês atual) — nunca os quatro indicadores completos da FIT-053, que já têm sua própria tela dedicada (`/painel/financeiro`); repetir tudo aqui seria redundante, não uma consolidação.
- Atalhos ("+ Novo aluno", "+ Novo treino", "Ver financeiro") apontam para rotas reais já existentes (`/painel/alunos/novo`, `/painel/treinos/novo`, `/painel/financeiro`) — nenhum atalho para uma tela que não existe.
- Mês de referência do indicador financeiro: sempre o mês atual (primeiro dia, UTC) no momento da requisição — nunca um filtro configurável nesta tela (o filtro de competência completo já existe em `/painel/financeiro`, FIT-053).
