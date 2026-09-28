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
  "orange": {"50":"#FFF2ED","100":"#FFDFD4","300":"#FFAD8F","500":"#FF7847","700":"#CC3600","900":"#701E00"},
  "teal": {"50":"#E4FBF7","100":"#BDF2EA","300":"#6CD4C7","500":"#21A69A","700":"#00766D","900":"#004E48"},
  "neutral": {"0":"#FFFFFF","50":"#F8FAFC","100":"#EDF1F4","300":"#C7CDD3","500":"#727A82","700":"#424A52","900":"#18212B"},
  "error": {"500":"#BA1A1A","100":"#FFDAD6"},
  "amber": {"100":"#FFDEA6","900":"#271900"}
}
```

**Marca oficial (ADR-012, 28/09/2026):** `navy` + `orange` substitui `navy` + `lime` como paleta oficial — `navy.900` (`#101C2C`) já era o azul-noturno da nova marca, sem mudança; `orange.500` (`#FF7847`) é o valor exato do laranja da marca, com os demais degraus derivados por interpolação HSL e verificados por contraste WCAG (ver ADR-012). `lime` foi removido — não há mais verde na paleta oficial, em nenhuma tela.

`amber` é uma extensão do M3 (o padrão oficial não define papel semântico de "atenção"/aviso, só `error`). Existe porque o pacote de redesign distingue "precisa de atenção" (convite expirando, avaliação vencendo, cobrança atrasada — reversível, não é falha) de `error` (reservado a destrutivo/fatal). Todo uso de `warning` é sempre acompanhado de ícone ou rótulo textual — nunca só a cor (critério de aceite "status não depende apenas de cor"). `amber` continua distinto de `primary` mesmo após a troca para laranja — nunca confundir aviso com ação positiva.

## Tema claro

```json
{
  "primary":"#CC3600",
  "onPrimary":"#FFFFFF",
  "primaryContainer":"#FFAD8F",
  "onPrimaryContainer":"#701E00",
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
  "primary":"#FFAD8F",
  "onPrimary":"#701E00",
  "primaryContainer":"#5E1900",
  "onPrimaryContainer":"#FFAD8F",
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

## Superfícies editoriais e navegação (ADR-014, pacote visual 2026)

Tokens aditivos para as telas públicas/editoriais do pacote visual 2026 (login, landing, onboarding, seleção de plano) e para o rail de navegação desktop (244px). Nunca substituem `surface`/`onSurfaceVariant`/`outlineVariant` (tema claro/escuro acima), que continuam reservados às superfícies internas do painel autenticado. Ver ADR-014 para a justificativa de cada valor.

Tema claro:

```json
{
  "surfaceEditorial":"#F5F7F8",
  "surfaceWarm":"#FFF0E8",
  "onSurfaceSecondary":"#637584",
  "outlineSoft":"#DBE4E8",
  "chromeActiveRow":"#27374A"
}
```

Tema escuro:

```json
{
  "surfaceEditorial":"#0E1722",
  "surfaceWarm":"#3A2415",
  "onSurfaceSecondary":"#A9B3BA",
  "outlineSoft":"#33404A",
  "chromeActiveRow":"#27374A"
}
```

`chromeActiveRow` é fixo (não alterna com o tema) — é chrome de marca, como `chrome`/`chromeContainer`, sempre azul-noturno independente do tema claro/escuro do conteúdo.

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
| `shape.medium` | 12 px | cards administrativos densos (tabelas, formulários) |
| `shape.large` | 16 px | painéis e dialogs |
| `shape.card` | 24 px | cards de domínio orgânicos (`AttentionItem`, `StudentCard`, `WorkoutTodayCard` e os demais componentes de `docs/04-backlog/` "Evolução em movimento") — raio amplo é requisito explícito do pacote de redesign, nunca a estética de ERP/planilha que `shape.medium` ainda serve para telas de gestão densa |
| `shape.full` | 999 px | chips, FAB e botões |

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
