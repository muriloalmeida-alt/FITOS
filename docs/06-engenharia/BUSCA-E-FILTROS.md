# Busca e filtros da biblioteca de exercícios (proposta 8, aprovada em 11/10/2026)

## Busca

- O campo "Buscar exercício" fica no topo da biblioteca e busca enquanto se digita, com 250 ms de espera.
- Com texto no campo aparecem o × ("Limpar busca") e o "Concluir busca". Enter também encerra a edição.
- Durante a edição, o modo foco sobe a lista: o cabeçalho, as abas, a navegação inferior, o botão + e o "Cadastrar exercício próprio" ficam escondidos.
  - Mecanismo: `body[data-keyboard="open"]` mais os marcadores `data-shell` e `data-search-hide`.

## Filtros

- O botão de filtro mostra um contador com o número de filtros aplicados.
- Na página aparecem só os filtros aplicados, como chips, cada um com "Remover filtro X".
- A modal "Filtrar exercícios" trabalha com um rascunho que só vai para a URL em "Ver resultados"; "Limpar" zera o rascunho.
  - Seções: Origem, Modalidade e Grupo muscular.
  - Tipo e Dificuldade ficam em "Mais filtros", recolhido.
- Os filtros continuam na URL (`q`, `origem`, `categoria`, `musculo`, `tipo`, `dificuldade`), então voltar e compartilhar o link preservam o estado.

## Lista

- Cada exercício tem uma miniatura de 56×56 com `object-fit: contain`.
- Sem resultado, a lista mostra "Nenhum exercício encontrado".

## Arquivos

- `src/app/painel/exercicios/LibraryControls.tsx`: busca, chips e modal.
- `src/app/painel/exercicios/page.tsx`: lista.
- `src/shared/ui/AppShell.tsx`: marcadores `data-shell`.

## Verificação local

As fotos do catálogo de dev apontam para o R2. Sem `R2_PUBLIC_BASE_URL` definida, o `next/image` recusa o host e a página cai na tela de erro. Rode o dev com a variável definida.
