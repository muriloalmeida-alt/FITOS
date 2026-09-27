# Biblioteca de Componentes — FitOS M3

## Regras gerais

- Usar componentes M3 como ponto de partida.
- Criar componente próprio apenas quando a tarefa não puder ser resolvida por composição.
- Variantes compartilham os mesmos tokens semânticos.
- Cada componente deve ter documentação, exemplos e testes de acessibilidade.

## Componentes fundamentais

| Grupo | Componentes | Estados mínimos |
|---|---|---|
| Ações | Filled, tonal, outlined, text e icon button; FAB | default, hover, focus, pressed, disabled, loading |
| Entrada | Text field, select, autocomplete, search, checkbox, radio, switch, slider | vazio, preenchido, focus, error, disabled, read-only |
| Navegação | App bar, navigation bar, rail, drawer, tabs, breadcrumbs | default, selected, hover, focus |
| Dados | Card, list, table, pagination, badge, tooltip | loading, empty, populated, error |
| Feedback | Snackbar, banner, dialog, progress, skeleton | info, success, warning, error |
| Seleção | Assist, filter, input e suggestion chips | default, selected, removable, disabled |
| Data e hora | Date picker, time picker, calendar cell | today, selected, unavailable, with-event |

## Componentes de domínio

> **PR1 do redesign mobile-first (FIT-117, "fundação visual, shell e componentes compartilhados")** implementou em `src/shared/ui/` a primeira versão em código de boa parte destas especificações, até então só descritas neste documento. **PR2 (FIT-120, "Personal — dashboard e alunos")** encaixou `StudentCard`, `AttentionItem` e `EvolutionMetric` nas telas reais do Personal (`PersonalHome`, `/painel/alunos`) pela primeira vez, com dados genuínos (nunca fabricados) compostos sobre os módulos já existentes. Cada componente abaixo com nota **Implementado (PRn)** tem arquivo `.tsx`/`.module.css`/`.test.tsx` reais; os sem essa nota continuam apenas especificados, aguardando o PR do fluxo que os usa.

### StudentCard

Conteúdo: avatar, nome, objetivo, última atividade, adesão e sinal de atenção. Ações secundárias ficam em menu; clicar abre o perfil.

**Implementado (PR1, encaixado em `/painel/alunos` na PR2):** `src/shared/ui/StudentCard.tsx`. Cobre avatar (reaproveita `Avatar`), nome, descrição e uma pílula de status com tom (`positive`/`warning`/`neutral`) — nunca só cor, sempre com texto. Em `/painel/alunos`, a descrição é o e-mail do aluno (mesmo dado já exibido antes do redesign) e a pílula reflete o status real do `Student` (`Ativo`/`Inativo`/`Vínculo encerrado`) — "objetivo" e "última atividade" (texto do tipo "Treinou hoje", do protótipo de referência) exigiriam uma nova consulta agregada por aluno (última sessão de treino) que não é sinal ainda exposto em nenhuma tela; registrado como pendência para uma PR futura, nunca fabricado como texto estático. Menu de ações secundárias por linha também segue pendente — a linha inteira já navega para o perfil do aluno, mesmo comportamento de antes do redesign.

### AttentionItem

Conteúdo obrigatório: severidade, fato, pessoa, tempo e ação. Não usar vermelho para simples ausência; vermelho é reservado a erro, bloqueio ou risco real.

**Implementado (PR1, encaixado no Início do Personal na PR2):** `src/shared/ui/AttentionItem.tsx`. Duas tonalidades (`neutral`/`warning`) usando o novo papel semântico `warning` (ver `M3-DESIGN-TOKENS.md`) — nunca vermelho/`error`, reservado a bloqueio real. A seção "Precisa de atenção" do `PersonalHome` (`getPersonalAttentionItems.ts`) é composição real sobre dados existentes, nunca fabricada: mensalidade vencida na competência atual (`listChargesForTenant`, tom `warning`) tem prioridade sobre avaliação atrasada há 60 dias ou nunca registrada (`getLastAssessmentDatesForTenant`, tom `neutral`) quando o mesmo aluno acumula os dois sinais — um item por aluno, lista sempre limitada a 5. Cada item navega para o perfil do aluno (`href`).

### ExerciseCard

Variações: biblioteca, builder e execução. Inclui mídia opcional (imagem; vídeo não é requisito obrigatório no MVP — ver Matriz de aderência ao escopo em `PRODUCT-DESIGN.md`), nome, grupo muscular, equipamento e ações contextuais.

**Implementado (PR1), variação execução/builder:** `src/shared/ui/WorkoutExerciseCard.tsx` — nome, meta (grupo muscular/equipamento) e miniatura (reaproveita `ExerciseThumbnail`, 56×56), com slot `trailing` livre para a ação contextual do contexto (ex.: `SetLogger` numa execução, alça de arraste num builder). A variação "biblioteca" já existe desde a FIT-111 nos cards de `/painel/exercicios`.

### SetRow

Campos no MVP: número da série, carga, repetições e conclusão. No mobile, deve permitir repetição rápida do valor anterior.

*(RPE/RIR são pós-MVP — hipótese sujeita à decisão de Produto; não incluir como campo do MVP.)*

**Implementado (PR1) como `SetLogger`:** `src/shared/ui/SetLogger.tsx`. Chip "série N de M", carga/repetições em destaque (`tabular-nums`) e botão de conclusão. "Repetição rápida do valor anterior" é responsabilidade de quem usa o componente (preencher `reps`/`load` com o valor da série anterior antes de renderizar) — o componente em si é sem estado de formulário próprio.

### RestTimer

Estados: parado, rodando, pausado e concluído. Precisa permanecer acessível durante navegação dentro do treino e oferecer vibração/som configuráveis.

**Implementado (PR1):** `src/shared/ui/RestTimer.tsx`. Cobre "rodando" e "concluído" (contagem regressiva a partir de `seconds`, `onComplete` disparado uma única vez ao chegar a zero). "Parado"/"pausado" e vibração/som configuráveis ficam para quando o componente for integrado à execução real de treino (PR5 — Aluno/Livre); nesta primeira versão o timer sempre inicia rodando ao montar.

### ProgressMetric

Exibe valor, período, comparação e definição. Nunca usar tendência positiva/negativa sem explicar a métrica.

**Implementado (PR1) como `EvolutionMetric`, encaixado no Início do Personal na PR2:** `src/shared/ui/EvolutionMetric.tsx`. Valor, rótulo e chip de tendência opcional (`direction: "up"|"down"|"neutral"`) — sempre com símbolo textual (▲/▼/—), nunca só cor, para nunca depender de percepção de cor para o significado. A "Visão geral" do `PersonalHome` usa os três números já existentes desde a FIT-060 (alunos ativos, treinos ativos, atrasado este mês), sem `trend` nesta rodada — nenhuma comparação histórica ("evoluíram na semana", do protótipo de referência) é composta hoje, e um chip de tendência sem uma métrica anterior real para comparar seria uma variação fabricada; registrado como possível PR futura, não um requisito desta.

### PaymentStatus

Estados persistidos: `pendente`, `pago`, `atrasado` e `cancelado`. “A vencer” é uma apresentação calculada de uma cobrança `pendente` com vencimento futuro, não um estado próprio. Pagamento parcial e estorno estão fora do MVP. Cada estado combina texto, ícone e cor.

**Implementado (PR1):** `src/shared/ui/PaymentStatus.tsx`, com `PaymentStatusValue` espelhando exatamente o enum `StudentChargeStatus` do schema (`PENDENTE`/`PAGO`/`ATRASADO`/`CANCELADO`). Cada estado tem um símbolo textual próprio (○/✓/!/✕) além de cor — "a vencer" continua sendo apresentação calculada por quem usa o componente, não um valor novo aceito por ele.

**Deliberadamente não encaixado em `/painel/financeiro` na PR4**: a pílula de status de `FinanceiroSection.tsx` continua sua própria implementação (`data-status`), porque ela já mostra "A vencer" — uma quinta apresentação calculada sobre `PENDENTE` com vencimento futuro, sem equivalente em `PaymentStatusValue` (que só aceita os 4 estados persistidos). Trocar pelo componente removeria essa distinção real, uma regressão de conteúdo, não uma limpeza visual — fica reservado para quando `PaymentStatus` ganhar essa variação, se Produto decidir que vale a pena.

### WorkoutBuilderStep

Etapas: contexto, exercícios, parâmetros e revisão. Salvar rascunho automaticamente e indicar o estado de salvamento (Salvando/Salvo/Erro).

### AIRecommendation (pós-MVP)

> **Nota de escopo:** este componente e o fluxo “Criar primeira versão com IA” (builder de treino) especificam a experiência para quando a prescrição assistida por IA for priorizada por Produto. Conforme `docs/00-governanca/ROADMAP.md`, a prescrição/recomendação de treino por IA está **fora do MVP** (Gate G5) — este componente é especificação **pós-MVP** (hipótese sujeita à decisão de Produto), não uma entrega do MVP, e não deve ser referenciado como recurso disponível nos fluxos, telas ou eventos analíticos atuais.

Mostra sugestão, justificativa, fonte/contexto utilizado e ações editar/aceitar/descartar. Nunca apresenta conteúdo como decisão definitiva.

### WorkoutTodayCard (novo, PR1)

Card de destaque escuro para "o treino de hoje" (jornada Aluno/Livre — `Hoje`), oposto deliberado das superfícies claras de gestão do Personal: eyebrow, título, descrição, metadados e uma única ação dominante (`href` ou `onClick`, nunca as duas ao mesmo tempo), com imagem opcional (`next/image` via `fill`). `src/shared/ui/WorkoutTodayCard.tsx`.

### AchievementCard (novo, PR1)

Card celebratório (fundo em gradiente, ícone, título, descrição) para reconhecimento de marcos de evolução — recorde pessoal, sequência de treinos, meta concluída. Sem ação própria; é sempre um cartão informativo. `src/shared/ui/AchievementCard.tsx`.

### EmptyStateAction (novo, PR1; encaixado em Exercícios/Treinos/Programas na PR3; Financeiro na PR4)

Estado vazio padrão para listas sem conteúdo (nenhum aluno, nenhum treino, nenhuma cobrança ainda): título, descrição e uma ação opcional (`href` ou `onClick`). Substitui qualquer texto solto de "nenhum item encontrado" por um padrão único e consistente. `src/shared/ui/EmptyStateAction.tsx`. Aplicado em `/painel/exercicios`, `/painel/treinos` e `/painel/treinos/planos` na PR3 (FIT-120) — o estado "sem resultado para a busca" continua um texto simples nesses três lugares (não é "lista vazia", é "filtro não encontrou nada"; a ação de convite não faz sentido ali). Aplicado também em `FinanceiroSection`/`RecorrenciasSection` (`/painel/financeiro`) na PR4 — "Nenhum aluno ativo para cobrar ainda" ganha ação real (`+ Cadastrar aluno` → `/painel/alunos/novo`); "Nenhuma cobrança/recorrência cadastrada ainda" fica sem ação própria (o formulário para criar já está logo abaixo, na mesma tela).

### ErrorRecovery (novo, PR1)

Estado de erro padrão (`role="alert"`), com título default ("Algo não funcionou como esperado"), descrição opcional e botão de nova tentativa opcional. Não é um dialog — vive inline, no lugar do conteúdo que falhou ao carregar. `src/shared/ui/ErrorRecovery.tsx`.

### MediaAttribution (novo, PR1)

Legenda discreta de crédito de mídia (fotos de banco de imagens da landing e de materiais promocionais). Puramente textual, sem interação. `src/shared/ui/MediaAttribution.tsx`.

### BrandLogo (novo, PR1 — FIT-117)

Wordmark/símbolo oficial do FitOS ("Fit" em peso médio + "OS" em peso forte, conforme `BENCHMARK-IDENTIDADE-VISUAL.md` §5.2 e `docs/03-design/APLICACAO-DA-MARCA-EM-CODIGO.md`). SVG local, sem dependência remota. Duas variantes: `horizontal` (texto real "Fit"+"OS", ícone sempre `aria-hidden`) e `symbol` (só o símbolo, `role="img"`+`aria-label="FitOS"` a menos que `decorative`). `background="dark"|"light"` escolhe a paleta de contraste correta. Aplicado nesta rodada ao `AppShell` (cabeçalho dos três papéis) e ao `LandingHeader`. **Pendência registrada, fora do escopo deste PR:** os painéis de formulário mobile de `/entrar`, `/criar-conta`, `/onboarding*` e `/treino-sozinho` (dentro de `AuthHero`, que fica `display: none` abaixo de 840px) ainda não exibem a marca em mobile — a FIT-117 continua parcialmente em aberto até uma PR dedicada tocar cada uma dessas páginas individualmente. `src/shared/ui/BrandLogo.tsx`.

## Tabelas no desktop

- Cabeçalho sticky quando houver rolagem longa.
- Ordenação explícita.
- Filtros resumidos em chips removíveis.
- Primeira coluna preserva identidade do registro.
- Ações por linha em menu; ação principal pode ser link no nome.
- Em telas compactas, tabela vira lista estruturada, não scroll horizontal como padrão.

## Formulários

- Uma pergunta por campo.
- Labels persistentes.
- Ajuda antes do erro quando a regra não for óbvia.
- Validação após interação ou envio; evitar erro enquanto o usuário digita.
- Alterações longas devem salvar rascunho.
- Etapas exibem progresso e permitem voltar sem perda.

## Dialogs e ações destrutivas

- Dialog apenas para decisão que interrompe o fluxo.
- Título descreve a ação: “Excluir treino?”
- Texto explica impacto e reversibilidade.
- Botão destrutivo usa `error`; cancelar permanece disponível.
- Não usar confirmação genérica “Tem certeza?”.

## QA por componente

- Teclado e leitor de tela.
- Temas claro e escuro.
- 200% de zoom.
- Conteúdo longo e nomes reais.
- Latência e loading.
- Erro de API.
- Touch target de 48 dp.
- Visual regression.
