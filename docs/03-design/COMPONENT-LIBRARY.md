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

### StudentCard

Conteúdo: avatar, nome, objetivo, última atividade, adesão e sinal de atenção. Ações secundárias ficam em menu; clicar abre o perfil.

### AttentionItem

Conteúdo obrigatório: severidade, fato, pessoa, tempo e ação. Não usar vermelho para simples ausência; vermelho é reservado a erro, bloqueio ou risco real.

### ExerciseCard

Variações: biblioteca, builder e execução. Inclui mídia, nome, grupo muscular, equipamento e ações contextuais.

### SetRow

Campos: número da série, carga, repetições, RPE opcional e conclusão. No mobile, deve permitir repetição rápida do valor anterior.

### RestTimer

Estados: parado, rodando, pausado e concluído. Precisa permanecer acessível durante navegação dentro do treino e oferecer vibração/som configuráveis.

### ProgressMetric

Exibe valor, período, comparação e definição. Nunca usar tendência positiva/negativa sem explicar a métrica.

### PaymentStatus

Estados: previsto, a vencer, recebido, atrasado, cancelado e estornado. Cada estado combina texto, ícone e cor.

### WorkoutBuilderStep

Etapas: contexto, exercícios, parâmetros e revisão. Salvar rascunho automaticamente e indicar sincronização.

### AIRecommendation

Mostra sugestão, justificativa, fonte/contexto utilizado e ações editar/aceitar/descartar. Nunca apresenta conteúdo como decisão definitiva.

> **Nota de escopo:** `AIRecommendation` e o fluxo "Criar primeira versão com IA" (builder de treino) especificam a experiência para quando a prescrição assistida por IA for priorizada. Conforme `docs/00-governanca/ROADMAP.md`, "Prescrição automática por IA" está **fora do MVP** — este componente é especificação antecipada, não uma entrega do MVP.

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
