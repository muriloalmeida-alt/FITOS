# Design Tokens M3 — FitOS

## Estratégia

O FitOS adota o Material Design 3 como base estrutural. A marca é aplicada por tokens semânticos, evitando cores e medidas hardcoded nos componentes.

Hierarquia de tokens:

1. **Primitivos:** valores brutos, como `navy.900`.
2. **Semânticos:** intenção de uso, como `color.surface`.
3. **De componente:** exceções controladas, como `button.primary.container`.

## Cores primitivas

```json
{
  "navy": {"50":"#EEF3F8","100":"#D5E0EA","300":"#91A6BA","500":"#506A82","700":"#263E55","900":"#101C2C"},
  "lime": {"50":"#F4FCE8","100":"#E3F8C4","300":"#BDF478","500":"#9DDB4A","700":"#5C970D","900":"#294900"},
  "teal": {"50":"#E4FBF7","100":"#BDF2EA","300":"#6CD4C7","500":"#21A69A","700":"#00766D","900":"#004E48"},
  "neutral": {"0":"#FFFFFF","50":"#F8FAFC","100":"#EDF1F4","300":"#C7CDD3","500":"#727A82","700":"#424A52","900":"#18212B"},
  "error": {"500":"#BA1A1A","100":"#FFDAD6"}
}
```

## Tema claro

```json
{
  "primary":"#3F6600",
  "onPrimary":"#FFFFFF",
  "primaryContainer":"#BDF478",
  "onPrimaryContainer":"#102000",
  "secondary":"#506173",
  "onSecondary":"#FFFFFF",
  "secondaryContainer":"#D4E5F8",
  "onSecondaryContainer":"#0D1D2A",
  "tertiary":"#006A61",
  "onTertiary":"#FFFFFF",
  "tertiaryContainer":"#9EF2E5",
  "onTertiaryContainer":"#00201D",
  "surface":"#F8FAFC",
  "surfaceContainer":"#EDF1F4",
  "surfaceContainerHigh":"#E5E9ED",
  "onSurface":"#18212B",
  "onSurfaceVariant":"#424A52",
  "outline":"#727A82",
  "outlineVariant":"#C2C8D0",
  "error":"#BA1A1A",
  "onError":"#FFFFFF"
}
```

## Tema escuro

```json
{
  "primary":"#A2D95C",
  "onPrimary":"#1E3700",
  "primaryContainer":"#2F4E00",
  "onPrimaryContainer":"#BDF478",
  "secondary":"#B8C8DB",
  "onSecondary":"#233240",
  "secondaryContainer":"#39495A",
  "onSecondaryContainer":"#D4E5F8",
  "tertiary":"#82D5C9",
  "onTertiary":"#003731",
  "tertiaryContainer":"#005049",
  "onTertiaryContainer":"#9EF2E5",
  "surface":"#0E1722",
  "surfaceContainer":"#182330",
  "surfaceContainerHigh":"#222E3B",
  "onSurface":"#E5EAF0",
  "onSurfaceVariant":"#C2C8D0",
  "outline":"#8C939B",
  "outlineVariant":"#424A52",
  "error":"#FFB4AB",
  "onError":"#690005"
}
```

## Tipografia

Família: `Manrope, system-ui, sans-serif`.

| Token | Tamanho/altura | Peso | Uso |
|---|---|---:|---|
| `display.large` | 44/52 | 700 | Hero institucional |
| `headline.large` | 32/40 | 700 | Título de página |
| `headline.medium` | 28/36 | 700 | Métrica ou modal principal |
| `title.large` | 22/28 | 700 | Seção |
| `title.medium` | 16/24 | 650 | Card |
| `body.large` | 16/24 | 450 | Conteúdo |
| `body.medium` | 14/20 | 450 | Tabelas e formulários |
| `label.large` | 14/20 | 650 | Botões |
| `label.medium` | 12/16 | 650 | Chips e metadados |

Números financeiros e tabelas usam `font-variant-numeric: tabular-nums`.

## Espaçamento

Base de 4 px: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.

- Padding de tela mobile: 16 px.
- Padding de tela tablet: 24 px.
- Padding desktop: 24–32 px.
- Gap padrão de formulário: 16 px.
- Gap entre seções: 32 px.

## Forma

| Token | Valor | Uso |
|---|---:|---|
| `shape.extraSmall` | 4 px | tags compactas |
| `shape.small` | 8 px | inputs |
| `shape.medium` | 12 px | cards |
| `shape.large` | 16 px | painéis e dialogs |
| `shape.full` | 999 px | chips e FAB |

## Elevação

- Nível 0: superfície base.
- Nível 1: cards interativos e top app bar.
- Nível 2: menus e elementos sticky.
- Nível 3: dialogs.
- Priorizar tonalidade e borda; sombra nunca deve ser o único indicador de hierarquia.

## Movimento

| Movimento | Duração | Curva |
|---|---:|---|
| Feedback curto | 100–150 ms | standard |
| Mudança de estado | 200 ms | standard |
| Entrada de painel | 250–300 ms | emphasized decelerate |
| Saída de painel | 180–220 ms | emphasized accelerate |

Respeitar `prefers-reduced-motion` e nunca bloquear tarefa com animação.

## Breakpoints

- Compact: 0–599 px.
- Medium: 600–839 px.
- Expanded: 840–1199 px.
- Large: 1200–1599 px.
- Extra large: ≥ 1600 px.

Conteúdo principal terá largura máxima de 1440 px; formulários lineares, 720 px.

## Acessibilidade

- Contraste mínimo AA.
- Foco com anel de 2 px e offset de 2 px.
- Área interativa mínima de 48 × 48 dp.
- Estados com cor + ícone + texto quando críticos.
- Light e dark theme validados separadamente.
