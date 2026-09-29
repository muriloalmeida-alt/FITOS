# Evidências — FIT-135 (PR5, pacote visual 2026 — consolidação)

## Auditoria de acessibilidade (axe-core 4.x, WCAG 2 A/AA)

Varredura automatizada contra `npm run dev` (Turbopack) nas três rotas públicas do pacote, viewport 390×844.

**Antes do ajuste:**

| Rota | Violações |
| --- | --- |
| `/entrar` | 0 |
| `/conheca` | 1 sério (`color-contrast`, 13 nós) |
| `/comecar` | 0 |

`/conheca` usava `--fitos-color-on-surface-secondary` (`#637584`, valor exato do pacote) sobre `surface-editorial`/`surface-container` — 4.19–4.43:1, abaixo do mínimo AA (4.5:1) para texto normal. Afeta o texto de apoio do card de convite, a introdução da biblioteca de exercícios, a lista "Personal e aluno, na mesma rotina" e os links do rodapé.

**Correção:** `--fitos-color-on-surface-secondary` ajustado para `#56636F` (mesmo tom, mais escuro) — 5.42–5.73:1 contra as duas superfícies, com margem. Tema escuro (`#A9B3BA`, 8.45:1) já passava e não foi tocado. Detalhe e justificativa completa no addendum de `ADR-014-TOKENS-SUPERFICIE-EDITORIAL-E-NAVEGACAO-ICONICA.md`.

**Depois do ajuste:**

| Rota | Violações |
| --- | --- |
| `/entrar` | 0 |
| `/conheca` | 0 |
| `/comecar` | 0 |

Cobertura da varredura: apenas regras `wcag2a`/`wcag2aa` do axe-core, nas três rotas públicas alcançáveis sem sessão/banco neste sandbox. Não cobre `/painel/*` (autenticado) nem verificação manual de leitor de tela/zoom 200% — ver lacunas abaixo.

## Revisão de código dos componentes do pacote (PR1–PR4)

Sem regressão encontrada nos padrões já estabelecidos:

- `alt=""` consistente em toda foto decorativa nova (`BrandLogo`, `PathPhotoCard`, `AuthHero`, `FinanceiroHero`, `WorkoutTodayCard`) — nenhuma foto editorial exposta como conteúdo informativo/avatar.
- `aria-current="page"` já presente em `AppShell`/`NavLink` para o destino ativo (herdado da FIT-012, inalterado por este pacote).
- Alvos de toque da navegação (`.navItem`, `.moreButton`) em 48×48px — acima do mínimo de 44px.
- `:focus-visible` (outline 2px) e `prefers-reduced-motion` (durações zeradas) já globais em `globals.css`, cobrindo todos os componentes novos sem necessidade de regra por componente.
- Sobreposições de texto sobre foto (`AuthHero`, `PathPhotoCard`, `FinanceiroHero`) usam gradiente navy escuro (`rgba(16,28,44,...)`, até 0.92 de opacidade) atrás do texto claro — mesma técnica em todas, contraste alto por construção.

## 4 larguras (360/390/768/1024/1440px) — rotas públicas

Recaptura completa nas 3 rotas públicas do pacote (mesmo método do FIT-132, `/tmp/pw-scratch/screenshot.mjs`): [`entrar-*.png`](.), [`conheca-*.png`](.) (recapturado após o ajuste de contraste), [`comecar-*.png`](.). Sem texto cortado, sem logo com fundo chapado sobre foto, sem ícone desalinhado, sem foto repetida na mesma região — confere com `prints-mobile/tela-01..03.png` e `prints-desktop/tela-01..03.png`, mesma composição já validada em FIT-132.

O selo circular preto com "N" visível nos cantos de algumas capturas é o indicador de ferramentas de desenvolvimento do Next.js (Turbopack, modo dev) — mesmo artefato já documentado em FIT-132, não existe em build de produção.

## Estados vazio/erro/carregamento

Nenhum componente novo deste pacote (FIT-131 a FIT-134) introduziu um estado vazio/erro/carregamento próprio — todos reutilizam ramos já existentes e testados:

- `AlunoHome`/`TreinoDeHoje`: os quatro estados (`SEM_PLANO`, `PLANO_ENCERRADO`, `DESCANSO`, treino ativo) são os mesmos da FIT-040/FIT-120, sem alteração de lógica — só o hero do estado "treino ativo" ganhou foto.
- `FinanceiroHero`: sempre renderiza (nunca vazio) porque `recebidoCents` sempre tem um valor numérico real (`0` quando não há recebimento no mês) — coberto por `FinanceiroHero.test.tsx` (caso `recebidoCents={0}` com fallback de foto).
- `PlanOptionCard`: sem estado de erro próprio — o formulário que o envolve (`ConviteCodeForm`, seleção de plano) mantém seu tratamento de erro anterior a este pacote.

## Gates executados (sandbox, sem PostgreSQL/Docker)

- `tsc --noEmit`: limpo.
- `eslint .`: limpo.
- `next build`: sucesso, todas as rotas listadas.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `vitest run`: 817 passaram / 349 falharam — todas as 349 falhas são testes de integração que dependem de PostgreSQL real (`Can't reach database server at localhost:5432`), mesma limitação de ambiente documentada desde FIT-131/FIT-007 (sem Docker/Postgres neste sandbox). O Gate do CI real (`Gate (typecheck, lint, testes com PostgreSQL real, build, audit)`, GitHub Actions, com serviço Postgres provisionado) é a validação de fato — passou limpo em PR1/PR2/PR3/PR4 e é a mesma esperada aqui.

## Lacunas explícitas (não escondidas) — pendentes do épico, não apenas deste PR

- **Zoom 200% e leitor de tela**: revisão manual (não automatizada) não executada neste sandbox — sem navegador com leitor de tela instalado/configurado disponível. O axe-core cobre parte da árvore de acessibilidade (nomes, papéis, contraste), mas não substitui a inspeção visual/assistiva que o plano exige.
- **Capturas reais de `/painel/*` (autenticado)**: mesma lacuna de todo o épico — sem PostgreSQL/Docker, não é possível autenticar como Personal/Aluno/Livre neste sandbox para capturar as telas renderizadas.
- **Validação em Railway homologação com contas reais dos três papéis**: este é o critério de aceite final do PR5 e do próprio EPIC-17 (`especificacoes/03-PLANO-DE-IMPLEMENTACAO-E-ACEITE.md`, item 5) e **não pode ser produzido a partir deste ambiente** — este sandbox não tem acesso de rede a `railway.app` (bloqueado pelo proxy de saída) nem contas reais. Requer o próprio Murilo (ou um ambiente com esse acesso) acessando `https://fitos-web-hml.up.railway.app` (produção de homologação, após merge) com contas reais de Personal, Aluno e FitOS Livre, nas 4 larguras, e dando o aceite visual explícito — nenhum teste automatizado ou diff de código substitui essa etapa, conforme o próprio plano exige.
