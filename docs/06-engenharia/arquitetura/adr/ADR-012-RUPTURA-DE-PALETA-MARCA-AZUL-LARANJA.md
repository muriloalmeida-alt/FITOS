# ADR-012 — Ruptura de paleta: navy + laranja substitui navy + lime como marca oficial

## Status

Aceito (28/09/2026, decisão de produto de Murilo, EPIC-16 — ver `docs/04-backlog/EPIC-16-MARCA-ENTRADA-E-MONETIZACAO-REAL.md` e `docs/03-design/MARCA-FITOS-OFICIAL.md`).

## Contexto

`M3-DESIGN-TOKENS.md` documentava `navy` + `lime` como a paleta oficial do FitOS desde a fundação do Design System (EPIC-03). O accent `lime` (verde) era usado como `primary` no tema claro/escuro e como destaque do "chrome" do shell (`--fitos-color-chrome-accent`).

A decisão de produto do EPIC-16 estabelece uma nova marca oficial, com um único requisito de cor: **azul-noturno `#101C2C` + laranja `#FF7847`** (fundo claro `#F5F7F8`). O azul-noturno já era exatamente `navy.900` — nenhuma mudança ali. O laranja não existia na paleta — substitui `lime` como accent/primary em todo o Design System.

## Decisão

1. Adicionar uma nova escala primitiva `orange` (50/100/300/500/700/900), com `orange.500 = #FF7847` (valor exato da marca) e os demais degraus derivados por interpolação HSL a partir do mesmo matiz/saturação, verificados por contraste WCAG:

   | Tom | Valor | Contraste vs. branco | Uso |
   |---|---|---|---|
   | 50 | `#FFF2ED` | — | fundo de destaque suave |
   | 100 | `#FFDFD4` | — | fundo de destaque |
   | 300 | `#FFAD8F` | 8.9:1 (com texto `orange.900`) | container claro / accent em fundo escuro |
   | 500 | `#FF7847` | 2.6:1 | valor de marca exato — não usado como par texto/fundo direto |
   | 700 | `#CC3600` | 5.1:1 | `primary` no tema claro (texto branco em cima) |
   | 900 | `#701E00` | 11.2:1 | `onPrimaryContainer` / `onPrimary` no tema escuro |

2. Tema claro — semântico:
   - `--fitos-color-primary: var(--fitos-orange-700)` (`#CC3600`), `onPrimary: #FFFFFF` (contraste 5.1:1, passa AA texto normal).
   - `--fitos-color-primary-container: var(--fitos-orange-300)` (`#FFAD8F`), `onPrimaryContainer: var(--fitos-orange-900)` (contraste 6.2:1).

3. Tema escuro — semântico:
   - `--fitos-color-primary: var(--fitos-orange-300)`, `onPrimary: var(--fitos-orange-900)` (contraste 8.9:1).
   - `--fitos-color-primary-container:` um tom customizado mais escuro (`#5E1900`, entre 700 e 900), `onPrimaryContainer: var(--fitos-orange-300)` (contraste 7.2:1).

4. Chrome do shell (`--fitos-color-chrome-accent`, `--fitos-color-chrome-active-bg`): trocam de `var(--fitos-lime-300)` para `var(--fitos-orange-300)`. `--fitos-color-chrome-active-fg` continua `navy.900` (contraste alto contra o novo accent claro, mesma lógica de antes).

5. `warning`/`amber` **não muda** — continua distinto de `primary`/`error`, conforme regra já documentada ("status não depende só de cor").

6. `lime` é removido da paleta primitiva e de todo consumo em código — nenhuma tela mantém o verde isoladamente (requisito explícito do EPIC-16: "não manter o verde-lima em telas isoladas").

## Consequências

- Ruptura visual real: qualquer componente que usava `--fitos-color-primary`/`--fitos-color-chrome-accent` muda de cor automaticamente (arquitetura de tokens semânticos já isolava os componentes da cor primitiva — nenhuma mudança de componente é necessária só por causa da cor, exceto onde a cor estava hardcoded fora do token, ver `BrandLogo.module.css`, tratado na FIT-124).
- `BrandLogo.tsx` deixa de ser um SVG desenhado à mão (proposta interna nunca aprovada) e passa a renderizar os vetores oficiais do pacote de marca (`public/marca/`), que já embutem as cores da nova marca diretamente no arquivo — não dependem dos tokens CSS.
- Documentação (`M3-DESIGN-TOKENS.md`, `BENCHMARK-IDENTIDADE-VISUAL.md`) atualizada para refletir a nova paleta antes de qualquer mudança em `tokens.css` (regra "nunca cor fora do documentado").
- Sem mudança de schema, sem mudança de comportamento — só apresentação visual.
