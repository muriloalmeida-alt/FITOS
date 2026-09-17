# Evidências — FIT-030

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, criação de modelo de treino, edição de dias sugeridos, adição de exercício com parâmetros de prescrição, arquivamento e reativação todos feitos através da UI e das rotas reais. A única exceção declarada é o exercício usado no modelo ("Supino reto fit030run2"): como o catálogo global depende de uma importação real da API Ninjas ainda pendente (ver ADR-004, SPRINT-06), esse único registro foi inserido diretamente via Prisma só para existir algo a selecionar no picker de exercícios — mesma técnica, e mesma ressalva, já usada na evidência da FIT-023. Todo o usuário, tenant, modelo e exercício sintéticos foram removidos do banco após a captura.

## Catálogo de modelos vazio (estado honesto, antes de qualquer modelo)

[Mobile, tema claro](modelos-vazio-mobile-claro.png): "Nenhum modelo de treino ainda. Crie o primeiro para começar a montar planos." — o item "Treinos" da navegação do personal deixa de ser "Em breve" e passa a ser um destino real.

## Modelo recém-criado, sem itens

[Mobile, tema claro](modelo-sem-itens-mobile-claro.png): "Status: Ativo", campo de nome editável, seletor de dias sugeridos, e a seção "Exercícios do modelo" com o estado honesto "Nenhum exercício adicionado ainda." e o formulário de adicionar exercício.

## Modelo com dias sugeridos e um item de prescrição

[Mobile, tema claro](modelo-com-item-mobile-claro.png) e [desktop, tema escuro](modelo-com-item-desktop-escuro.png): dias "Seg"/"Qua" marcados e salvos ("Alterações salvas."), e o item "Supino reto fit030run2 · peito · 3 séries · 10 repetições · carga: 40kg · descanso: 60s" — confirma que os seis parâmetros de prescrição (séries, repetições, duração, carga, descanso, observação — duração e observação vazios neste caso, por isso omitidos do resumo) são aceitos e exibidos corretamente, e que os botões de mover (▲/▼) e remover aparecem por item.

## Catálogo de modelos com o modelo criado

[Mobile, tema claro](modelos-lista-mobile-claro.png) e [desktop, tema escuro](modelos-lista-desktop-escuro.png): "1 modelo de treino" — "Treino A fit030run2" com os dias sugeridos ("SEGUNDA, QUARTA") visíveis na listagem. A navegação lateral do desktop mostra "Treinos" corretamente posicionado entre "Exercícios" e "Financeiro" (Em breve).

## Modelo arquivado

[Mobile, tema claro](modelo-arquivado-mobile-claro.png): "Status: Arquivado" — os dias sugeridos e o item de prescrição permanecem intactos (arquivar nunca é exclusão física nem perda de dados).

## Arquivado não aparece na listagem padrão

[Mobile, tema claro](modelos-sem-o-arquivado-mobile-claro.png): após arquivar, a listagem volta a mostrar "0 modelos de treino" (só havia um modelo, agora arquivado) — confirma que `listWorkoutsForTenant` filtra por `status: ATIVO`.

## Modelo reativado

[Mobile, tema claro](modelo-reativado-mobile-claro.png): "Status: Ativo" novamente — o ciclo completo criar → arquivar → reativar funciona através da UI real, sem perder nome, dias sugeridos ou itens.

## Resultado das validações

`npm ci` (instalação limpa) · `npx prisma generate` · `npm run lint` · `npm run typecheck` · `npm run test` (331/331 — 17 novos testes de integração em `workouts.integration.test.ts` contra Postgres real, incluindo a prova do TRIGGER de imutabilidade de snapshot da ADR-005; 27 novos testes de rota com mocks; 11 novos testes de página) · `npm run build` (rotas `/painel/treinos`, `/painel/treinos/novo`, `/painel/treinos/[id]` e as sete rotas de API `/api/workouts/**` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos. Migration aditiva `20260917000000_add_workout_prescription_and_status` testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
