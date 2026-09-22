# Evidências — FIT-112 (Entrada do onboarding com os três caminhos)

Capturas reais (Playwright contra `npm run dev`, servidor local).

## Etapa 1 — decisão

- [Desktop](01-entrada-passo1-desktop.png): "Passo 1 de 2", os três cartões (Sou Personal / Tenho convite do meu personal, com o campo de código reaproveitado da FIT-110 / FitOS Livre).
- [Mobile](02-entrada-passo1-mobile.png): mesma decisão em coluna única.

## Etapa 2 — cadastro (só depois de uma escolha explícita)

- [Personal](03-entrada-passo2-personal.png): "Passo 2 de 2", formulário de personal, botão "← Voltar".
- [FitOS Livre](05-entrada-passo2-individual.png): mesma etapa 2, texto e `role` do FitOS Livre.

## "Voltar" com confirmação quando há dados preenchidos

- [Depois de aceitar a confirmação](04-entrada-voltou-passo1.png): de volta à etapa 1, dados descartados.
- Verificado via `page.on("dialog")` do Playwright (não uma captura, um log): preencher "Nome completo" e clicar "← Voltar" dispara `window.confirm` com a mensagem "Você tem dados preenchidos que serão perdidos. Quer mesmo voltar?" — descartar o diálogo mantém a etapa 2 (`?modo=personal` na URL), aceitar navega para a etapa 1 (`/criar-conta`). Sem dados preenchidos, "Voltar" navega direto, sem diálogo.
