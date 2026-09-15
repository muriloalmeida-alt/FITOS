# FitOS — Diretrizes de Product Design

## 1. Tese visual

Uma central de trabalho esportiva, precisa e moderna: superfícies escuras, contraste alto, dados fáceis de ler e cor de ação usada com parcimônia. A interface deve transmitir desempenho sem parecer um aplicativo de fisiculturismo agressivo. O Material Design 3 (Seção 7) é o Design System escolhido para executar esta tese, não para substituí-la.

## 2. Princípios

- Mobile first para treino e consulta rápida.
- Desktop otimizado para montagem de treinos e gestão da carteira.
- A ação principal de cada tela deve ser evidente.
- Evitar painéis cheios de indicadores sem decisão associada.
- Usar linguagem familiar ao personal trainer brasileiro.
- Mostrar progressivamente detalhes técnicos do exercício.

## 3. Arquitetura de informação

### Área do personal

- Início
- Alunos
- Treinos
- Exercícios
- Financeiro
- Configurações

### Área do aluno

- Hoje
- Meu plano
- Histórico
- Evolução
- Perfil

## 4. Primeira experiência do personal

Quando ainda não houver dados, a página inicial deve orientar uma sequência curta:

1. Cadastrar primeiro aluno.
2. Criar ou importar exercícios.
3. Montar primeiro treino.
4. Atribuir o plano.

## 5. Telas prioritárias

- Painel do personal.
- Lista e perfil do aluno.
- Construtor de treino.
- Pesquisa e seleção de exercícios.
- Plano semanal e atribuição.
- Treino do dia do aluno.
- Registro de sessão.
- Lista de cobranças e resumo financeiro.

## 6. Comportamentos essenciais

- Construtor de treino deve permitir reordenação clara e edição sem perder contexto.
- Busca de exercícios deve distinguir catálogo FitOS, importado e exercício próprio.
- Atribuição de plano deve mostrar aluno, vigência e impacto sobre o plano atual antes de confirmar.
- Registro de pagamento exige confirmação visual e permite correção auditável.
- Informações vazias explicam a próxima ação, sem telas meramente decorativas.

## 7. Design System oficial — Material Design 3

### 7.1 Decisão

- O **Material Design 3 (M3)** é o Design System oficial do FitOS a partir desta Sprint.
- O M3 fornece tokens, componentes, estados e diretrizes de acessibilidade já testados, reduzindo decisões visuais ad-hoc e acelerando a implementação.
- Adotar o M3 não substitui a tese visual da Seção 1: o esquema de cores, a tipografia e os componentes são configurados a partir de um **tema customizado**, nunca do tema padrão claro/roxo do M3.
- Toda tela nova deve ser composta a partir dos tokens e componentes desta seção antes de se criar qualquer variação visual própria.

### 7.2 Tema e tokens de cor

- Tema padrão do FitOS: **modo escuro** (`dark color scheme` do M3); o modo claro existe como alternativa secundária, sem prioridade no MVP.
- Cor semente (`seed color`) do esquema dinâmico M3: o azul vivo/ciano de ação da identidade FitOS, usada para gerar as paletas tonais `primary`, `secondary` e `tertiary`.
- Mapeamento dos papéis de cor M3 para a identidade FitOS:
  - `surface` e as variações `surface-container` (mais claras a cada nível): preto, azul muito escuro e cinza grafite.
  - `on-surface` (texto principal): **branco suave** — o branco continua sendo a cor de maior destaque sobre as superfícies escuras. `on-surface-variant` (texto secundário): cinza claro.
  - `primary` / `on-primary`: azul vivo ou ciano controlado — cor de ação, usada com parcimônia.
  - `error` / `on-error`: vermelho — atraso e erro.
  - Cores estendidas do M3 (`extended colors`), fora da paleta base, para os papéis que o M3 não define nativamente: `success` (verde) e `warning` (âmbar).
- Contraste mínimo **AA** (4.5:1 para texto normal, 3:1 para texto grande) obrigatório em todo par `on-*` / superfície usado em qualquer tela.

### 7.3 Tipografia

- Escala tipográfica M3 (`display`, `headline`, `title`, `body`, `label`, cada uma em `large`/`medium`/`small`) substitui tamanhos de fonte livres.
- Fonte sem serifa, com números tabulares habilitados nos estilos `body` e `label` usados em dados financeiros.
- `display`/`headline` reservados para valores em destaque (resumo financeiro, indicadores do painel); `title` para cabeçalhos de tela e de seção.

### 7.4 Forma, elevação e movimento

- Tokens de forma M3 (`shape.corner`, de `none` a `full`) definem o raio de cada componente: cartões usam `corner.medium`/`large`; botões e chips usam `corner.full`.
- Elevação M3 (níveis 0 a 5) substitui sombra livre: no tema escuro, elevação é expressa principalmente por tonalidade de `surface-container` (mais clara a cada nível), com sombra reduzida — mantém a diretriz de evitar excesso de bordas e sombras.
- Transições usam os tokens de movimento M3 (`easing` e `duration` padronizados), aplicados à reordenação no construtor de treino e às trocas de estado de tela.

### 7.5 Componentes

- **Navegação:** `Navigation rail`/`Navigation drawer` M3 no desktop; `Navigation bar` M3 (inferior) no celular — implementa a navegação lateral no desktop e compacta no celular.
- **Ação principal:** `FAB` (Floating Action Button) M3 para a ação primária de cada tela (novo aluno, novo treino, novo lançamento).
- **Listas e cartões:** `Card` M3 (`elevated`, `filled` ou `outlined` conforme hierarquia) para alunos, exercícios e cobranças; `List item` M3 para as tabelas financeiras convertidas em lista no celular.
- **Formulários:** `Text field` M3 (`outlined`, adequado ao tema escuro) para cadastro de aluno, exercício e cobrança.
- **Feedback:** `Snackbar` M3 para confirmação de ações (ex.: pagamento registrado); `Dialog` M3 para confirmações destrutivas ou de impacto (ex.: atribuição de plano sobre plano vigente).
- **Seleção e filtro:** `Chip` M3 (`filter`/`assist`) para os filtros de exercícios (grupo muscular, tipo, dificuldade, equipamento).
- **Progresso:** `Progress indicator` M3 (linear ou circular) para os estados de carregamento.

### 7.6 Estados

- Todo componente interativo implementa as camadas de estado do M3 (`state layers`): `enabled`, `hover`, `focus`, `pressed`, `dragged` e `disabled`, com a opacidade padrão do M3 sobre a cor do componente.
- `disabled` sempre reduz contraste e remove a cor de ação, sem nunca remover o componente da tela sem explicação — mantém a diretriz de estados vazios orientativos.
- Estado de erro de campo (`Text field` M3 em `error`) usa exclusivamente os tokens `error`/`on-error-container`, nunca cor livre.

### 7.7 Acessibilidade

- Área de toque mínima de 48×48dp (padrão M3), especialmente nos controles usados durante o treino.
- Contraste mínimo AA em todo par de cor da Seção 7.2; nenhuma informação crítica (estado de cobrança, alerta financeiro) depende só de cor — sempre acompanhada de ícone ou texto.
- Suporte a ampliação de texto e ao `dynamic type` do M3 sem quebrar layout.
- Foco visível (`focus state layer`) obrigatório em navegação por teclado, mesmo em um produto mobile first.

## 8. Responsividade

- Mobile first permanece o princípio de layout (Seção 2); as classes de tamanho de janela do M3 (`compact`, `medium`, `expanded`) formalizam os breakpoints usados para alternar entre navegação compacta (celular, `compact`) e navegação lateral (desktop, `expanded`).
- Tabelas financeiras seguem se convertendo em `List item`/`Card` M3 na classe `compact`.
- Controles usados durante o treino mantêm as áreas de toque da Seção 7.7 em qualquer classe de tamanho.
- Conteúdo principal permanece utilizável com ampliação de texto e com o `dynamic type` do M3.
