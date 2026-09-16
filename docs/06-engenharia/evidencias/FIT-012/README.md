# Evidências — FIT-012

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com cadastro/login reais via `/entrar` (senha real, cookie de sessão real) — nenhuma tela editada manualmente. Usuários, tenant e vínculo sintéticos foram removidos do banco (`fitos_dev`) imediatamente depois.

## Personal — mobile (compact), tema claro

[Antes de abrir "Mais"](personal-mobile-claro-pre-mais.png) e [com "Mais" aberto](personal-mobile-claro-mais.png): barra de navegação inferior com os 4 primeiros destinos (Início ativo; Alunos, Treinos, Financeiro em "Em breve") e o botão "Mais", que revela "Configurações" (também "Em breve") — nenhum dos quatro é um link navegável, conforme testado em `AppShell.test.tsx`.

## Personal — desktop (≥ 840px)

[Tema claro](personal-desktop-claro.png) e [tema escuro](personal-desktop-escuro.png): rail lateral com todos os 5 destinos visíveis (Início ativo e destacado; os demais em "Em breve"). O tema escuro não exigiu nenhum código novo — segue os tokens já existentes desde a fundação do projeto (`prefers-color-scheme`).

## Aluno vinculado

[Mobile, tema claro](aluno-mobile-claro.png): barra inferior com exatamente 4 destinos (Hoje ativo; Treino, Progresso, Perfil em "Em breve") — sem necessidade de agrupar sob "Mais", conforme `UX-ARCHITECTURE.md`.

[Desktop, tema escuro](aluno-desktop-escuro.png): mesma rail lateral usada pelo personal, com os destinos do aluno.

## Aluno sem vínculo (estado real, não um erro)

[Mobile, tema claro](aluno-sem-vinculo-mobile-claro.png): sessão válida de um usuário ALUNO sem `Student` vinculado — tela mínima de "sem permissão" (`AlunoSemVinculo`), sem nenhum shell/navegação (não há destino de negócio a oferecer sem vínculo), apenas a mensagem e o botão de logout, que continua funcional.

## Nota metodológica: rate limiting de login descoberto durante a captura

Ao automatizar login real repetidas vezes para gerar estas evidências, a 4ª chamada consecutiva a `/api/auth/sign-in/email` (dentro de ~10s, mesmo IP) recebeu `429 Too Many Requests`. Investigação (`node_modules/better-auth/dist/api/rate-limiter/index.mjs`) confirmou que o Better Auth 1.7.5 já aplica, **por padrão, sem nenhuma configuração deste projeto**, uma regra especial de 3 requisições por 10 segundos para `/sign-in`, `/sign-up`, `/change-password` e `/change-email`. Isso corrige um registro anterior incorreto em `docs/06-engenharia/arquitetura/AUTENTICACAO-E-SESSAO.md` (FIT-009), que afirmava não haver nenhuma mitigação de força bruta — a seção foi corrigida nesta rodada. Por esse motivo, o script de captura loga cada usuário sintético **uma única vez** e reaproveita a mesma sessão (variando viewport/tema com `setViewportSize`/`emulateMedia`, sem novo login) para todas as suas capturas.

## Resultado das validações

`npm run lint`, `npm run typecheck`, `npm run test` (84/84 — 8 novos: 4 de `AppShell.test.tsx`, 4 de `page.test.tsx`), `npm run build` — todos limpos. Detalhes completos no PR desta História.
