# Acessibilidade e Consolidação Visual (FIT-070)

Auditoria final de acessibilidade (WCAG 2.2 AA) e consistência visual sobre tudo que o programa construiu (SPRINT-00 a SPRINT-10), com correção real de cada achado — não um relatório sem ação. Ver nota de transparência sobre a origem desta Sprint em `docs/04-backlog/EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`.

## Método

Sem nenhuma dependência nova (mesma disciplina de zero-dependência já seguida desde a FIT-006): contraste de cor auditado matematicamente (relative luminance / contrast ratio, fórmula WCAG padrão) sobre os valores hex já documentados em `M3-DESIGN-TOKENS.md`; foco de teclado e semântica de elementos interativos auditados por leitura de código dos componentes compartilhados (`src/shared/ui/`), já que qualquer achado ali se propaga para toda a aplicação (mesmo princípio de "auditar o sistema de design, não cada tela individualmente" usado no escopo desta Sprint).

## Auditoria de contraste — tokens M3 (WCAG 2.2 AA, texto normal ≥ 4.5:1)

| Par (texto/fundo) | Claro | Escuro |
|---|---:|---:|
| onPrimary / primary | 6.75:1 ✅ | 7.88:1 ✅ |
| onPrimaryContainer / primaryContainer | 13.33:1 ✅ | 7.41:1 ✅ |
| onSecondary / secondary | 6.37:1 ✅ | 7.69:1 ✅ |
| onSecondaryContainer / secondaryContainer | 13.34:1 ✅ | 7.19:1 ✅ |
| onTertiary / tertiary | 6.49:1 ✅ | 7.74:1 ✅ |
| onTertiaryContainer / tertiaryContainer | 13.30:1 ✅ | 7.26:1 ✅ |
| onSurface / surface | 15.54:1 ✅ | 14.91:1 ✅ |
| onSurfaceVariant / surface | 8.60:1 ✅ | 10.71:1 ✅ |
| onSurface / surfaceContainer | 14.32:1 ✅ | 13.13:1 ✅ |
| onSurfaceVariant / surfaceContainer | 7.93:1 ✅ | 9.43:1 ✅ |
| onSurface / surfaceContainerHigh | 13.33:1 ✅ | 11.41:1 ✅ |
| onError / error | 6.46:1 ✅ | 7.72:1 ✅ |
| primary / surface (links/texto colorido) | 6.45:1 ✅ | 10.84:1 ✅ |

**Resultado**: todos os pares de texto usados pela aplicação passam WCAG AA com margem confortável (mínimo 6.37:1, bem acima do limiar 4.5:1) — confirma, com número real, a afirmação do gate G1 do roadmap ("contraste AA aprovado", SPRINT-01). Os tons "positivo"/"negativo" introduzidos nas SPRINT-09/10 (cartões de "Pago"/"Atrasado" em `FinanceiroSection.tsx`/`PersonalHome.tsx`) reaproveitam exatamente os pares `onTertiaryContainer`/`tertiaryContainer` e `onError`/`error` já auditados acima — nenhuma cor nova foi introduzida fora do token.

## Auditoria de contraste não-textual (SC 1.4.11, bordas de componentes interativos, ≥ 3:1)

| Par | Claro | Escuro |
|---|---:|---:|
| outline / surface | 4.16:1 ✅ | 5.81:1 ✅ |
| outlineVariant / surface | 1.61:1 ❌ | 2.00:1 ❌ |

`outline` (usado nas bordas de `TextField` e `Button` variante `outlined` — os únicos componentes cuja borda *identifica* um controle interativo) passa com folga. `outlineVariant` (usado em `Card` e nos divisores estruturais do `AppShell` — cabeçalho, navegação inferior, painel lateral) fica abaixo de 3:1 nos dois temas.

**Julgamento registrado**: SC 1.4.11 exige 3:1 apenas para "informação visual necessária para identificar componentes de interface e seus estados" — divisores estruturais e o contorno de um `Card` (que já é diferenciado do fundo da página por cor de superfície, não só pela borda) não são, em sentido estrito, "componentes de interface" nessa definição; são agrupadores de conteúdo estático. Mesmo assim, por ser uma correção de baixo risco e alto valor perceptível para usuários de baixa visão, `Card.module.css` foi atualizado para usar `outline` em vez de `outlineVariant` (o contêiner mais repetido em toda a aplicação — maior impacto por menor mudança). Os divisores estruturais do `AppShell` (cabeçalho, navegação, painel lateral) foram deliberadamente **não** alterados nesta rodada: mudar um token usado em três lugares estruturais de todas as telas, sem uma nova passada visual completa de QA, seria um risco desproporcional ao benefício nesta última Sprint — registrado como achado conhecido, não uma correção pendente ignorada.

## Achado corrigido — `Button` sem indicador de foco visível

`Button.module.css` não definia nenhuma regra `:focus-visible` — usuário de teclado navegando por Tab nunca via qual botão estava focado em nenhuma tela da aplicação (todo fluxo de personal e aluno usa este componente). Viola diretamente a seção "Acessibilidade" de `M3-DESIGN-TOKENS.md` ("Foco com anel de 2 px e offset de 2 px") e a SC 2.4.7 (Focus Visible, AA) do WCAG. `TextField` já cumpria essa regra desde a FIT-006; `Button` nunca teve o equivalente. Corrigido adicionando a mesma regra (`outline: 2px solid var(--fitos-color-primary); outline-offset: 1px;`) — mesmo valor de offset já usado por `TextField`, mantendo os dois componentes visualmente consistentes entre si (o texto do token cita 2px de offset; o par já implementado desde a FIT-006 usa 1px — tratado como o valor de fato já estabelecido pela implementação existente, não uma nova decisão desta Sprint).

## Achado corrigido — `<button>` aninhado dentro de `<a>` (HTML inválido, achado sistêmico)

Padrão `<Link href="..."><Button type="button">Rótulo</Button></Link>` estava presente em pelo menos 8 pontos da aplicação, desde a FIT-013 (`+ Cadastrar aluno`) até a própria FIT-060 (atalhos do painel operacional): `PersonalHome.tsx`, `AlunoHome.tsx`, `painel/alunos/page.tsx`, `painel/alunos/[id]/page.tsx`, `painel/alunos/[id]/inativar/page.tsx`, `painel/treinos/page.tsx`, `painel/treinos/planos/page.tsx`, `painel/exercicios/page.tsx`. Um `<button>` dentro de um `<a>` é HTML inválido (o modelo de conteúdo de `<a>` proíbe elementos interativos aninhados) e cria dois elementos focáveis por teclado para uma única ação, com comportamento de Enter/clique inconsistente entre navegadores e leitores de tela.

**Correção**: `Button` (`src/shared/ui/Button.tsx`) ganhou uma prop opcional `href` — quando presente, renderiza um único `next/link` estilizado como botão (`<Link href={href} className={...}>`), nunca um `<button>` aninhado. Todos os 8 pontos foram migrados de `<Link href="X"><Button>Y</Button></Link>` para `<Button href="X">Y</Button>`. Nenhum teste precisou ser alterado — a suíte já testava esses elementos via `getByRole("link", ...)` (o papel do elemento externo, que era o único que a Testing Library conseguia resolver de forma inequívoca mesmo antes da correção), confirmando que o bug era real mas silenciosamente invisível à cobertura de testes existente até esta auditoria.

## Varredura responsiva (360/768/1024/1440px, claro e escuro)

Decisão de escopo (`EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`): varredura representativa, não exaustiva de todas as ~20 telas. Capturado nos 4 breakpoints exigidos, tema claro e escuro:

- `/entrar` — tela de autenticação (formulário linear, o bloco mais simples do sistema de design);
- `/painel` (personal) — o `AppShell` completo (navegação compacta/expandida, `Card`, `Button`, indicadores) recém-consolidado pela FIT-060;
- `/painel/financeiro` — a tela mais densa em dados/formulários da aplicação;
- `/painel/treino/sessao` (aluno) — fluxo mobile-crítico já documentado como "uma mão, resiliente a falha de conexão" desde a FIT-041.

Evidência em `docs/06-engenharia/evidencias/FIT-070/`. Nenhuma quebra de layout, sobreposição de texto ou conteúdo cortado encontrada em nenhuma combinação de breakpoint/tema capturada.

## Gate final integral

`npm run test` (573/573 — 1 novo teste em `Button.test.tsx` provando que a variante `href` nunca aninha um `<button>` dentro do `<a>`) · `npm run lint` · `npm run typecheck` · `npm run build` — todos limpos após as correções desta Sprint.
