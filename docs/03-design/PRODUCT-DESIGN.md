# FitOS — Diretrizes de Product Design

## Mapa da documentação de Design

| Documento | Uso |
|---|---|
| `PRODUCT-DESIGN.md` (este arquivo) | Visão geral, tese, princípios, índice e matriz de aderência ao escopo |
| `BENCHMARK-IDENTIDADE-VISUAL.md` | Benchmark competitivo, marca, paleta, tom de voz e direção visual completa |
| `M3-DESIGN-TOKENS.md` | Tokens de cor (claro/escuro), tipografia, espaço, forma, elevação e movimento |
| `UX-ARCHITECTURE.md` | Papéis, JTBD, arquitetura de informação, jornadas, estados e analytics |
| `COMPONENT-LIBRARY.md` | Inventário e regras dos componentes M3, incluindo componentes de domínio |
| `CRITICAL-SCREEN-SPECS.md` | Especificação funcional das telas prioritárias |
| `RESEARCH-AND-TESTING-PLAN.md` | Plano de pesquisa com usuários, testes de usabilidade e métricas |
| `DESIGN-GOVERNANCE.md` | Fluxo de decisão, QA visual, versionamento do Design System e templates complementares de Issue/PR |

Ordem de leitura recomendada: este documento → Benchmark → Tokens M3 → Arquitetura de UX → Componentes → Telas críticas → Pesquisa e validação → Governança de design.

## 1. Tese visual

Uma central de trabalho esportiva, precisa e moderna: superfícies com contraste alto, dados fáceis de ler e cor de ação usada com parcimônia. A interface deve transmitir desempenho sem parecer um aplicativo de fisiculturismo agressivo.

**Conceito decidido: "Sistema em movimento".** FitOS é o sistema operacional que organiza o negócio do personal e mantém cada aluno em movimento. Assinatura: **"FitOS — Seu negócio em movimento."** Detalhamento completo do benchmark, plataforma de marca e tom de voz em `BENCHMARK-IDENTIDADE-VISUAL.md`.

O Material Design 3 (Seção 7) é o Design System escolhido para executar esta tese, não para substituí-la.

## 2. Princípios

- Plataformas: **web responsiva** para o personal (desktop otimizado para gestão da carteira e montagem de treinos) e **mobile-first** para o aluno (treino e consulta rápida).
- Personal e aluno têm conta própria já no MVP — o aluno não é apenas um registro administrado pelo personal, é um usuário autenticado com acesso restrito ao próprio tenant.
- A ação principal de cada tela deve ser evidente.
- Evitar painéis cheios de indicadores sem decisão associada.
- Usar linguagem familiar ao personal trainer brasileiro.
- Mostrar progressivamente detalhes técnicos do exercício.

## 3. Arquitetura de informação (escopo MVP)

Visão resumida do escopo do MVP; arquitetura completa — incluindo os itens pós-MVP (Agenda, Relatórios, Mensagens) — e detalhamento de papéis, Jobs to be Done, jornadas e navegação adaptativa por breakpoint em `UX-ARCHITECTURE.md`.

### Área do personal (MVP)

Início, Alunos, Treinos, Financeiro, Configurações.

### Área do aluno (MVP)

Hoje, Treino, Progresso, Perfil. Acesso via conta própria, restrita ao tenant do personal ao qual o aluno está vinculado.

> Agenda, Relatórios e Mensagens são pós-MVP — ver "Matriz de aderência ao escopo" (Seção 11).

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
- Treino em execução no celular do aluno.
- Financeiro (visão geral e recebimentos).

Especificação funcional completa de cada tela (hierarquia, ações, critérios de aceite e estados) em `CRITICAL-SCREEN-SPECS.md`.

## 6. Comportamentos essenciais

- Construtor de treino deve permitir reordenação clara e edição sem perder contexto.
- Busca de exercícios deve distinguir catálogo FitOS, importado e exercício próprio.
- Atribuição de plano deve mostrar aluno, vigência e impacto sobre o plano atual antes de confirmar.
- Registro de pagamento exige confirmação visual e permite correção auditável.
- Informações vazias explicam a próxima ação, sem telas meramente decorativas.

## 7. Identidade de marca e Design System oficial — Material Design 3

### 7.1 Decisão

- O **Material Design 3 (M3)** é o Design System oficial do FitOS.
- Direção de marca decidida: conceito **"Sistema em movimento"**, paleta **OS Navy** `#101C2C`, **Motion Lime** `#9DDB4A`, **Flow Teal** `#21A69A`, **Cloud** `#F5F7F8` e **Graphite** `#26313D`; tipografia **Manrope**; ícones **Material Symbols Rounded**.
- Esta decisão substitui a formulação genérica anterior desta seção ("azul vivo/ciano" sem marca nomeada), mantendo a mesma tese visual da Seção 1.
- Toda tela nova deve ser composta a partir dos tokens e componentes de `M3-DESIGN-TOKENS.md` e `COMPONENT-LIBRARY.md` antes de se criar qualquer variação visual própria.

### 7.2 Tema e tokens de cor

- FitOS suporta **tema claro e tema escuro**, ambos tratados como temas reais (não inversão automática) — valores completos, incluindo JSON pronto para uso, em `M3-DESIGN-TOKENS.md`.
- Papéis M3 mapeados à marca: `primary`/`onPrimary` derivados de Motion Lime (tom mais escuro no tema claro para manter contraste AA); `surface`/`onSurface` derivados de OS Navy e Graphite no tema escuro, Cloud no tema claro; `tertiary` (Flow Teal) reservado a dados de saúde e informação.
- Cores de gráfico (`#67B51C`, `#007C72`, `#3D6FD8`, `#7655C6`, `#B26A00`, `#BA1A1A`) não substituem os tokens de feedback e nunca são o único meio de compreensão de um estado.
- Contraste mínimo **AA** (4.5:1 texto normal, 3:1 texto grande) obrigatório em todo par `on-*`/superfície.

### 7.3 Tipografia

- Família: **Manrope** (`Manrope, system-ui, sans-serif`), variável, disponível no Google Fonts.
- Escala tipográfica M3 completa (`display`, `headline`, `title`, `body`, `label`, tamanhos e pesos) em `M3-DESIGN-TOKENS.md`.
- Algarismos tabulares (`font-variant-numeric: tabular-nums`) obrigatórios em tabelas financeiras e séries de treino.

### 7.4 Forma, elevação e movimento

- Grid base de 4 px; raios de 8 px (campos) a 16 px (painéis), `full` em chips/FAB.
- Elevação expressa preferencialmente por tonalidade de superfície, não por sombra livre.
- Movimento entre 100–300 ms conforme o tipo de transição; respeitar `prefers-reduced-motion` sempre.
- Detalhamento completo em `M3-DESIGN-TOKENS.md`.

### 7.5 Componentes

Biblioteca completa (fundamentais M3 e componentes de domínio como `StudentCard`, `AttentionItem`, `RestTimer`, `PaymentStatus`) em `COMPONENT-LIBRARY.md`. `AIRecommendation` também está especificado ali, mas é **pós-MVP** — não deve ser referenciado como recurso disponível nos fluxos atuais. Navegação usa `Navigation rail`/`drawer` no desktop do personal e `Navigation bar` distinta para personal e aluno no mobile — as duas experiências não compartilham a mesma arquitetura de navegação.

### 7.6 Estados

Todo componente interativo implementa as camadas de estado do M3 (`enabled`, `hover`, `focus`, `pressed`, `dragged`, `disabled`), nunca comunicando um estado crítico só por cor — sempre com ícone e texto de apoio.

### 7.7 Acessibilidade

- Meta mínima **WCAG 2.2 AA**; área de toque mínima de 48×48 dp; foco visível em toda navegação por teclado; zoom de 200% sem perda de conteúdo ou funcionalidade.

## 8. Responsividade

- Breakpoints M3 formalizados em `M3-DESIGN-TOKENS.md`: compact (0–599px), medium (600–839px), expanded (840–1199px), large (1200–1599px), extra large (≥1600px).
- Validação obrigatória em 360, 768, 1024 e 1440 px (ver `CRITICAL-SCREEN-SPECS.md`).
- Tabelas financeiras convertem-se em lista/card M3 na classe `compact`; a adaptação prioriza a tarefa, não apenas empilha colunas.

## 9. Pesquisa e validação

Plano de pesquisa com personal trainers e alunos, testes de usabilidade moderados (com tarefas restritas ao escopo do MVP) e métricas de produto relacionadas ao design em `RESEARCH-AND-TESTING-PLAN.md`.

## 10. Governança de design

O fluxo de Issue → branch → PR, QA visual, versionamento do Design System e templates complementares estão em `DESIGN-GOVERNANCE.md`. Identificadores, convenção de branch e de título de PR seguem exclusivamente `docs/00-governanca/GOVERNANCA.md` — `DESIGN-GOVERNANCE.md` não introduz uma convenção paralela.

## 11. Matriz de aderência ao escopo

Classificação de cada capacidade documentada em `docs/03-design/` frente ao escopo do MVP confirmado por Produto. "Hipótese" indica um item que só se torna pós-MVP definitivo (ou é descartado) por decisão futura de Produto.

| Capacidade | Classificação | Documento de origem | Observação/restrição |
|---|---|---|---|
| Autenticação e conta do personal | MVP | `docs/01-produto/PRD-01-MVP.md`, `docs/04-backlog/BACKLOG-MVP.md` (FIT-001) | — |
| Autenticação e conta do aluno | MVP | Decisão de Produto | Acesso próprio, restrito ao tenant do personal ao qual está vinculado |
| Cadastro e gestão de alunos | MVP | `UX-ARCHITECTURE.md`, `CRITICAL-SCREEN-SPECS.md` | — |
| Biblioteca de exercícios | MVP | `CRITICAL-SCREEN-SPECS.md` | Fonte API-Ninjas + exercício próprio; preview de mídia é imagem, não vídeo |
| Integração com API Ninjas | MVP | `docs/02-integracoes/INTEGRACAO-API-NINJAS.md` | Exclusivamente pelo backend |
| Montagem e atribuição de treinos | MVP | `CRITICAL-SCREEN-SPECS.md`, `COMPONENT-LIBRARY.md` | Builder sem IA — ver linha "Criação/recomendação de treino por IA" |
| Execução e registro de treinos | MVP | `CRITICAL-SCREEN-SPECS.md` | Sem sincronização offline — ver linha "Sincronização offline" |
| Evolução básica do aluno | MVP | `UX-ARCHITECTURE.md`, `docs/01-produto/PRD-01-MVP.md` | — |
| Gestão financeira | MVP | `CRITICAL-SCREEN-SPECS.md`, `COMPONENT-LIBRARY.md` | Estados persistidos: `pendente`, `pago`, `atrasado`, `cancelado`. "A vencer" é apresentação calculada de `pendente`; sem pagamento parcial nem estorno |
| Dashboard operacional | MVP | `CRITICAL-SCREEN-SPECS.md` | Sem card de Agenda |
| Criação/recomendação de treino por IA | Pós-MVP | `COMPONENT-LIBRARY.md` (`AIRecommendation`), `UX-ARCHITECTURE.md` | Gate G5 em `docs/00-governanca/ROADMAP.md`; retirada dos fluxos e eventos de analytics atuais |
| RPE/RIR | Hipótese | `COMPONENT-LIBRARY.md` (`SetRow`), `CRITICAL-SCREEN-SPECS.md` (Builder) | Sujeito à decisão futura de Produto; não é campo do MVP |
| Sincronização offline | Pós-MVP | `CRITICAL-SCREEN-SPECS.md`, `UX-ARCHITECTURE.md` | MVP trata apenas falha de conexão com nova tentativa; não promete armazenamento nem sincronização |
| Vídeo como requisito obrigatório | Hipótese | `COMPONENT-LIBRARY.md` (`ExerciseCard`), `CRITICAL-SCREEN-SPECS.md` (Builder) | Mídia de exercício é opcional (imagem); vídeo não é obrigatório no MVP |
| Agenda | Pós-MVP | `UX-ARCHITECTURE.md`, `docs/00-governanca/ROADMAP.md` | Retirada da arquitetura de informação e do dashboard do MVP |
| Mensagens | Pós-MVP | `UX-ARCHITECTURE.md` | Retirada da arquitetura de informação de personal e aluno no MVP |
| Relatórios avançados | Pós-MVP | `UX-ARCHITECTURE.md`, `docs/00-governanca/ROADMAP.md` | Fase 6 do roadmap permanece pós-MVP |
| Administração de academias | Pós-MVP | `UX-ARCHITECTURE.md` | Já identificado como "futuro" na arquitetura de papéis |

## Nota de escopo

O pacote de origem desta documentação incluía um "prompt mestre" para instruir a implementação em código (auditoria do repositório, matriz de gaps, sequência de PRs de implementação) e um asset visual (`assets/fitos-concept-board.png`). O prompt mestre é uma instrução operacional para uma etapa futura de engenharia, não documentação de produto decidida — por isso não foi versionado, na mesma lógica já aplicada a `INSTRUCOES-AO-CLAUDE.md` na Sprint 00. O asset visual é referência conceitual opcional, tratada como não bloqueante do aceite de FIT-004 — ver detalhes em `DESIGN-GOVERNANCE.md` e no PR correspondente.
