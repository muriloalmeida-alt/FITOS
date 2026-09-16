# Evidências — FIT-023

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de exercício próprio, busca, arquivamento e reativação todos feitos através da UI e das rotas reais. A única exceção declarada é o **exercício global** ("Push-up fit023run1"): como nenhuma importação real da API Ninjas está autorizada nesta Sprint (ver ADR-004 e a seção "Situação da licença" abaixo), esse único registro foi inserido diretamente via Prisma só para existir algo com `origin: API_NINJAS` a fotografar — **não é uma importação real**, e o catálogo unificado nunca chama a API Ninjas para consultas normais (comprovado pelo estado vazio abaixo, capturado antes de qualquer inserção). Todo o usuário, tenant e os dois exercícios sintéticos foram removidos do banco após a captura.

## Catálogo vazio (estado honesto, antes de qualquer exercício)

[Mobile, tema claro](catalogo-vazio-mobile-claro.png): "Nenhum exercício no catálogo ainda. Cadastre um exercício próprio para começar." — nenhuma chamada à API Ninjas ocorre para produzir esta tela; é o resultado real de uma consulta ao PostgreSQL sem nenhum exercício global importado e sem nenhum exercício próprio ainda cadastrado.

## Catálogo combinado — global e próprio, origem visível

[Mobile, tema claro](catalogo-mobile-claro.png) e [desktop, tema escuro](catalogo-desktop-escuro.png): "Push-up fit023run1" com selo **Global** e "Rosca direta fit023run1" com selo **Meu exercício** — a origem de cada exercício é sempre visível na listagem. O item "Exercícios" aparece na navegação do personal entre "Alunos" e "Treinos" (posicionamento provisório, mesmo tratamento já usado por "Alunos" na FIT-013 e "Perfil" do aluno na FIT-016 — o destino real não espera o pai conceitual existir).

## Busca por nome — resultado filtrado

[Mobile, tema claro](catalogo-busca-filtrada-mobile-claro.png): busca por "Rosca direta fit023run1" retorna apenas esse exercício.

## Busca sem resultado — estado distinto do catálogo vazio

[Mobile, tema claro](catalogo-sem-resultado-mobile-claro.png): "Nenhum resultado para essa busca." — mensagem diferente da do catálogo vazio acima, para não confundir "não há nada cadastrado" com "sua busca não encontrou nada".

## Detalhe do exercício global — somente leitura

[Mobile, tema claro](detalhe-global-mobile-claro.png) e [desktop, tema escuro](detalhe-global-desktop-escuro.png): todos os campos (tipo, músculo, equipamento, dificuldade, instruções, informações de segurança) em formato somente leitura — **sem formulário de edição, sem card de ciclo de vida**. Exercícios globais nunca são editáveis ou arquiváveis por um personal.

## Detalhe do exercício próprio — edição e ciclo de vida

[Mobile, tema claro](detalhe-proprio-mobile-claro.png) e [desktop, tema escuro](detalhe-proprio-desktop-escuro.png): "Origem: Meu exercício · Status: Ativo", formulário de edição completo e botão "Arquivar exercício".

## Exercício próprio arquivado

[Mobile, tema claro](detalhe-proprio-arquivado-mobile-claro.png): "Status: Arquivado", card "Ciclo de vida" agora com "Reativar exercício" em vez de "Arquivar exercício" — o detalhe continua acessível mesmo depois de arquivado.

## Arquivado não aparece na listagem padrão

[Mobile, tema claro](catalogo-sem-o-arquivado-mobile-claro.png): após arquivar, a listagem volta a mostrar só o exercício global — confirma que `listCatalogExercises` filtra por `status: ATIVO` enquanto o detalhe (`getCatalogExerciseForTenant`) permanece acessível para permitir a reativação.

## Exercício próprio reativado

[Mobile, tema claro](detalhe-proprio-reativado-mobile-claro.png): "Status: Ativo" novamente, botão "Arquivar exercício" de volta — o ciclo completo criar → arquivar → reativar funciona através da UI real.

## Resultado das validações

`npm ci` (instalação limpa) · `npx prisma generate` · `npm run lint` · `npm run typecheck` · `npm run test` (ver contagem final no PR — inclui as 10 novas integrações de `catalog.integration.test.ts` e os 15 novos testes de página) · `npm run build` (rotas `/painel/exercicios`, `/painel/exercicios/novo` e `/painel/exercicios/[id]` registradas) · `npm audit` — todos limpos. Não houve nenhuma migration nesta História (nenhuma mudança de schema; FIT-023 é exclusivamente consulta e UI sobre o schema já entregue pela FIT-021/FIT-022).
