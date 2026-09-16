# Evidências visuais — FIT-009

Capturadas com Playwright (Chromium) contra o build de produção local (`npm run build && npm run start`), tema via `prefers-color-scheme` emulado.

- [Login — mobile, tema claro](entrar-mobile-claro.png)
- [Login — mobile, tema escuro](entrar-mobile-escuro.png)
- [Criar conta — desktop, tema claro](criar-conta-desktop-claro.png)
- [Painel — rota protegida, sessão real de um personal recém-cadastrado (dados sintéticos, removidos após a captura)](painel-autenticado.png)

A captura de `painel-autenticado.png` percorreu o fluxo real: preencheu `/criar-conta`, submeteu, seguiu o redirecionamento para `/painel` e fotografou a página autenticada — não é uma tela editada manualmente. O usuário sintético criado para a captura (`evidencia-fit009-*@example.test`) foi removido do banco de desenvolvimento imediatamente depois.
