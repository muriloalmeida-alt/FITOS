# Evidências — FIT-111 (Biblioteca ilustrada de exercícios)

Capturas reais (Playwright contra `npm run dev`, servidor local + PostgreSQL real com os 208 exercícios da IMP-EX-002 e as 43 imagens já vinculadas por esta História).

## Landing (seção 8B do pacote)

- [Desktop](01-landing-biblioteca-desktop.png): teaser "Biblioteca ilustrada de exercícios" com a contagem real (43, derivada do próprio manifesto de importação — nunca hardcoded), texto "biblioteca em expansão", disponibilidade para Personal/Aluno vinculado/FitOS Livre, 4 exemplos com ilustração e legenda, e o texto de exemplo de busca/filtro.
- [Mobile](02-landing-biblioteca-mobile.png): mesma seção em grade de 2 colunas.

## Catálogo (`/painel/exercicios`)

- [Lista, desktop](03-catalogo-lista-desktop.png): cards com miniatura — exercícios já vinculados mostram a ilustração real; os demais (ainda sem imagem no acervo de 43) mostram o placeholder "Sem imagem", nunca uma quebra visual.
- [Busca "agachamento"](04-catalogo-busca-agachamento.png): filtro por nome já existente (FIT-023) continua funcionando com a nova coluna de imagem — resultados com e sem ilustração aparecem lado a lado, honestamente.
- [Detalhe com imagem](05-catalogo-detalhe-com-imagem.png): "Agachamento livre com barra" — ilustração grande no topo do detalhe, alt funcional (verificado nos testes, não nesta captura).
- [Lista, mobile](06-catalogo-lista-mobile.png): grade de 1 coluna, mesmo padrão de card com imagem/placeholder.

## Achados registrados durante a verificação (não bugs de produto)

- No mobile, a captura da seção "Biblioteca ilustrada de exercícios" após `scrollIntoView` mostra só a segunda linha do título ("exercícios") visível abaixo do cabeçalho fixo (sticky) — a primeira linha ("Biblioteca ilustrada de") fica coberta pelo cabeçalho no instante exato da captura. É um artefato de enquadramento do script de captura (mesmo padrão de sobreposição que qualquer âncora sob cabeçalho fixo teria, já existente desde a FIT-110 para `#recursos`/`#para-quem`/`#comecar`) — o título real no DOM e sua acessibilidade (`getByRole("heading", { name: "Biblioteca ilustrada de exercícios" })`, testado) estão corretos. Não é uma regressão desta História; registrado aqui só para rastreabilidade.
