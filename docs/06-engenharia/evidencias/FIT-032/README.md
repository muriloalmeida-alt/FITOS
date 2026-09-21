# Evidências — FIT-032

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, criação de dois modelos de treino, criação de um programa, adição/reordenação/remoção de modelos, arquivamento e reativação todos feitos através da UI e das rotas reais. Nenhum dado inserido diretamente no banco. Todo o usuário, tenant, modelos e programa sintéticos foram removidos do banco após a captura.

## Bug encontrado e corrigido durante esta captura

A primeira rodada de captura (descartada, não incluída aqui) mostrou o programa "Meus modelos" — o plano rascunho implícito auto-provisionado desde a FIT-030 — aparecendo na listagem de "Programas" como se o personal o tivesse criado deliberadamente. A causa: `ensureDraftTrainingPlanForTenant` identificava o rascunho por heurística ("o primeiro `TrainingPlan` criado, por `createdAt`"), que quebra se o personal criar um plano real antes de qualquer modelo avulso. Corrigido com uma migration aditiva (`20260920000000_add_training_plan_draft_bucket`) adicionando `TrainingPlan.isDraftBucket` (identificação explícita, não heurística, com índice único parcial garantindo no máximo um por tenant) — `listTrainingPlansForTenant` agora exclui esse plano da listagem voltada ao personal. Dois testes de regressão cobrem exatamente esse cenário em `workouts.integration.test.ts`. Ver `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md` para o detalhe completo.

## Catálogo de programas vazio (estado honesto)

[Mobile, tema claro](programas-vazio-mobile-claro.png): "0 programas" — mesmo já existindo dois modelos de treino (no plano rascunho implícito, invisível nesta listagem, conforme o bug corrigido acima).

## Programa recém-criado, sem modelos

[Mobile, tema claro](programa-sem-modelos-mobile-claro.png): "Status: Ativo", vigência sugerida "4" semanas, seção "Modelos do programa" com o estado honesto "Nenhum modelo agrupado neste programa ainda." e o picker de adicionar modelo.

## Programa com dois modelos agrupados

[Mobile, tema claro](programa-com-modelos-mobile-claro.png) e [desktop, tema escuro](programa-com-modelos-desktop-escuro.png): "Treino A" e "Treino B" agrupados, cada um com botões de mover (▲/▼) e remover — confirma que "adicionar ao programa" move o modelo do plano rascunho para o programa real.

## Programa reordenado

[Mobile, tema claro](programa-reordenado-mobile-claro.png): após clicar "Mover Treino B para cima", a ordem passa a ser Treino B, Treino A.

## Catálogo de programas com o programa criado

[Mobile, tema claro](programas-lista-mobile-claro.png) e [desktop, tema escuro](programas-lista-desktop-escuro.png): "1 programa" — "Programa A" com "4 semanas" visível na listagem. A navegação lateral do desktop mostra "Treinos" com a sub-navegação "Modelos"/"Programas".

## Modelo removido do programa

[Mobile, tema claro](programa-apos-remover-modelo-mobile-claro.png): após remover "Treino B", o programa mostra apenas "Treino A" — o modelo removido volta para o plano rascunho (não é excluído nem arquivado; continua disponível para ser adicionado a outro programa).

## Programa arquivado

[Mobile, tema claro](programa-arquivado-mobile-claro.png): "Status: Arquivado" — o modelo agrupado permanece intacto.

## Arquivado não aparece na listagem padrão

[Mobile, tema claro](programas-sem-o-arquivado-mobile-claro.png): "0 programas" após arquivar o único programa existente.

## Programa reativado

[Mobile, tema claro](programa-reativado-mobile-claro.png): "Status: Ativo" novamente, modelo preservado.

## Resultado das validações

`npm run test` (389/389 — 39 novos testes de integração em `workouts.integration.test.ts` contra Postgres real, incluindo os dois testes de regressão do bug do plano rascunho; novos testes de rota e de página) · `npm run lint` · `npm run typecheck` · `npm run build` (rotas `/painel/treinos/planos`, `/painel/treinos/planos/novo`, `/painel/treinos/planos/[id]` e as seis rotas de API `/api/training-plans/**` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos. Migration aditiva `20260920000000_add_training_plan_draft_bucket` testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
