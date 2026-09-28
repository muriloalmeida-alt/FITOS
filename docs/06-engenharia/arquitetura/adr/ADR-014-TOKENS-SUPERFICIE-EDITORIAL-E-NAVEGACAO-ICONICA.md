# ADR-014 — Tokens de superfície editorial e navegação icônica (pacote visual 2026)

## Status

Aceito (28/09/2026, pacote de implementação visual aprovado por Murilo — `FitOS_Pacote_Visual_Aprovado_2026-09-28.zip`, [FIT-131 #170](https://github.com/muriloalmeida-alt/FitOS/issues/170), sub-issue de [EPIC-17 #169](https://github.com/muriloalmeida-alt/FitOS/issues/169)).

## Contexto

O pacote visual 2026 (referência final para as 11 telas em mobile 390×844 e desktop 1440×900) especifica uma paleta em hex exatos: navy `#101C2C`, laranja `#FF7847`, fundo claro editorial `#F5F7F8`, branco `#FFFFFF`, superfície quente `#FFF0E8`, texto secundário `#637584`, borda `#DBE4E8`. Navy e laranja já são exatamente `--fitos-navy-900` e `--fitos-orange-500` (ADR-012) — nenhuma mudança ali. Os quatro valores restantes não têm um token semântico existente com o mesmo hex exato: `--fitos-color-surface` (`#F8FAFC`), `--fitos-color-on-surface-variant` (`#424A52`) e `--fitos-color-outline-variant` (`#C2C8D0`) são próximos, mas visivelmente diferentes lado a lado com o pacote de referência.

O contrato (`01-CONTRATO-VISUAL-E-ROTAS.md`) instrui explicitamente: "mapear para os tokens existentes... e documentar extensões necessárias" — nunca reaproveitar um token visualmente diferente do valor de referência sem decisão registrada.

O pacote também introduz uma segunda superfície de navegação por papel (rail desktop de 244px com linha selecionada `#27374A`) — um tom intermediário entre `navy.700` (`#263E55`) e `navy.900` (`#101C2C`) que também não existe na escala primitiva.

## Decisão

1. Adicionar quatro tokens semânticos novos, todos derivados de valores já usados pela marca ou pelo pacote aprovado — nenhuma cor arbitrária nova:
   - `--fitos-color-surface-editorial: #F5F7F8` — fundo de página nas telas públicas/editoriais do pacote (login, landing, onboarding, seleção de plano). Distinto de `--fitos-color-surface` (`#F8FAFC`, tom neutro já usado nas superfícies internas do painel) — mantém os dois, nunca substitui um pelo outro fora do escopo deste pacote.
   - `--fitos-color-surface-warm: #FFF0E8` — realce pálido de marca (ex.: indicador ativo da navegação inferior mobile, aviso de trial/oferta). Mais claro que `--fitos-orange-50` (`#FFF2ED`) — hex distinto do pacote, mantido exato.
   - `--fitos-color-on-surface-secondary: #637584` — texto secundário sobre `surface-editorial`/`surface-warm`, mais claro que `--fitos-color-on-surface-variant` (`#424A52`, reservado às superfícies internas já existentes).
   - `--fitos-color-outline-soft: #DBE4E8` — borda de card em `surface-editorial`, mais clara que `--fitos-color-outline-variant` (`#C2C8D0`).
2. Adicionar um token de chrome novo: `--fitos-color-chrome-active-row: #27374A` — fundo da linha selecionada no rail de navegação desktop (244px), distinto de `--fitos-color-chrome-active-bg` (`--fitos-orange-300`, reservado ao indicador da navegação inferior mobile — pílula clara sobre chrome escuro). Duas superfícies de navegação, dois tratamentos de "ativo" documentados separadamente, nunca confundidos.
3. Texto laranja pequeno sobre branco/`surface-editorial` usa `--fitos-orange-700` (já existente, `--fitos-color-primary` no tema claro) — nunca `orange-500` puro, que não passa AA em texto pequeno (ADR-012 já documentava isso; este ADR só reafirma para o novo contexto editorial).
4. Nenhum token existente é removido ou tem seu valor alterado. Esta é uma extensão aditiva, escopada às telas/componentes do pacote visual 2026 — o painel autenticado interno (cards de conteúdo, listas) continua usando os tokens `surface`/`on-surface-variant`/`outline-variant` exatamente como antes.

## Consequências

- `src/shared/design-system/tokens.css` e `docs/03-design/M3-DESIGN-TOKENS.md` ganham os cinco tokens acima, documentados com o mesmo par claro/escuro do restante do sistema (ver seção de tema escuro em `tokens.css`).
- Componentes do pacote (heroes editoriais, `AppShell` mobile/desktop, `CreditCardFields`/cards de plano quando aplicável) devem usar esses tokens, nunca o hex literal do pacote diretamente em CSS.
- Se uma tela futura fora do escopo deste pacote precisar de uma superfície "quente"/"editorial" parecida, reaproveita estes tokens — não cria um terceiro par equivalente.
