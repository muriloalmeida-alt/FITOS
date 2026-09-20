# Evidências — FIT-070

Todas as 32 capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, exercício, modelo de treino, programa, atribuição, cobrança e início real da sessão de treino pelo aluno através da UI real — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal e aluno), tenant e dados sintéticos foram removidos do banco após a captura.

Decisão de escopo (ver `docs/04-backlog/EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`): varredura representativa, não exaustiva de todas as ~20 telas da aplicação. Quatro telas capturadas nos 4 breakpoints exigidos (360/768/1024/1440px) × 2 temas (claro/escuro) = 32 capturas:

- `entrar-*` — tela de autenticação, o bloco mais simples do sistema de design (formulário linear);
- `painel-personal-*` — o "Início" do personal consolidado pela FIT-060 (`AppShell` completo: navegação compacta/expandida, `Card`, `Button` em ambas as variantes);
- `painel-financeiro-*` — a tela mais densa em dados/formulários da aplicação (FIT-050 a FIT-053);
- `painel-treino-sessao-*` — o fluxo mobile-crítico do aluno em execução real de treino (FIT-041), com o formulário de resultado e o temporizador de descanso visíveis.

## Achado corrigido durante esta própria captura: sublinhado indevido nos botões-link

A primeira rodada de captura (descartada, dados sintéticos já removidos) revelou visualmente que `Button` com a nova prop `href` (ver seção "Achado corrigido" em `ACESSIBILIDADE-E-CONSOLIDACAO-VISUAL.md`) herdava o sublinhado padrão do navegador para `<a>` — nunca resetado em `Button.module.css`, porque antes desta Sprint `Button` nunca era o próprio elemento `<a>`. Corrigido (`text-decoration: none` + `display: inline-flex` centralizando o conteúdo, igual ao comportamento de um `<button>`) e a suíte completa (573/573), lint, typecheck e build revalidados antes de recapturar. As 32 capturas finais neste diretório já refletem a correção — nenhum botão-link aparece sublinhado em nenhuma das 32.

## Artefato conhecido de ferramenta de captura (não é um bug do produto)

Nas capturas `*-360px-*` e `*-768px-*` (breakpoints "compact", onde a navegação é uma barra inferior fixa — `position: fixed` desde a FIT-012, comportamento correto e intencional em um dispositivo real), a captura `fullPage` do Playwright posiciona a barra fixa em um ponto do meio do conteúdo em vez de repeti-la corretamente em cada "página" da rolagem — artefato conhecido de ferramentas de screenshot com elementos `position: fixed` em capturas de página inteira, não uma falha de layout real (a barra de navegação sempre se comporta corretamente para um usuário real, que nunca rola uma "screenshot inteira" de uma vez). Nas capturas `*-1024px-*`/`*-1440px-*` a navegação é um painel lateral em fluxo normal (não fixo) — o artefato não ocorre nesses breakpoints.

## Resultado das validações

`npm run test` (573/573 — 1 novo teste em `Button.test.tsx`) · `npm run lint` · `npm run typecheck` · `npm run build` — todos limpos, revalidados após as duas correções desta Sprint (foco de teclado do `Button`, `<button>` aninhado em `<a>`) e antes desta captura final.
