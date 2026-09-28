# Evidências — FIT-129 (Revisão visual integral)

Capturas reais via Playwright contra `npm run dev` (banco `fitos_dev` local, catálogo de planos reconciliado com `npm run planos:seed-comerciais`) — fluxo completo das três jornadas de entrada, ponta a ponta, com contas reais criadas pela própria interface (nunca inseridas diretamente no banco, exceto o convite do aluno, que usa a função real `generateInvitation`).

**Ambiente**: dev local deste sandbox, não homologação real (Railway `fitos-web-hml`) — ver pendência explícita no relatório final (`RELATORIO-FINAL-EPIC-16.md`). Larguras completas (360/768/1024/1440) foram capturadas para todas as telas listadas na Issue #154; aqui ficam as mais representativas de cada uma (o conjunto completo, 51 capturas, foi revisado nesta sessão mas não commitado por volume).

## Entrada pública

- [`/entrar`, desktop](01-entrar-1440.png): hero fotográfico full-bleed com a citação da marca, formulário à direita.
- [`/entrar`, mobile 360px](01-entrar-360.png): hero fotográfico removido (sem espaço), formulário centralizado — decisão de design já existente, não uma regressão desta revisão.
- [`/conheca`](02-conheca-1440.png): landing comercial pública com a marca azul-noturno/laranja.
- [`/comecar`](03-comecar-1440.png): os três cartões de escolha (Personal / convite / FitOS Livre) — nunca um formulário genérico.

## Onboarding do Personal (FIT-113/FIT-126)

- [Passo 3 — Escolha seu plano](04-onboarding-personal-plano-1440.png): catálogo real (Personal 20/50/Ilimitado, R$49,90/69,90/99,90, disclosure de trial de 30 dias) — confirma que a reconciliação da FIT-127 está ativa e que o wizard nunca usa uma lista fixa.
- [Passo 4 — Revisão](05-onboarding-personal-revisao-1440.png): resumo com o plano escolhido incluído.
- [Dashboard, desktop](06-dashboard-personal-1440.png) e [mobile](06-dashboard-personal-360.png): marca aplicada (chrome navy, destaque laranja), sem nenhum controle nativo sem estilo.
- [Checkout/assinatura](07-checkout-assinatura-1440.png): `/painel/assinatura` já reflete a assinatura contratada no onboarding ("Personal 20", ativa) e os demais planos reais disponíveis para troca.

## Onboarding do FitOS Livre (FIT-101/FIT-126)

- [Passo 2 — Plano e conclusão](08-onboarding-livre-plano-1440.png): catálogo real do FitOS Livre (R$19,90/mês, trial de 30 dias) — lista vinda do backend, hoje com um produto só, mas nunca hardcoded.
- [Dashboard "Hoje"](09-dashboard-livre-1440.png).

## Aluno convidado (FIT-015/FIT-126)

- [Ativação de conta](10-ativar-conta-1440.png): tela real a partir de um token gerado pela função de domínio `generateInvitation` (nunca inserido direto no banco).
- [Dashboard do aluno](11-dashboard-aluno-1440.png): **confirmação visual de que não existe nenhuma menção a plano, preço ou cobrança** — o aluno nunca vê nem paga por nada relativo à assinatura do próprio personal, conforme o requisito do pacote.

## Amostra de telas secundárias do Personal

- [Exercícios](12-personal-exercicios-1024.png): catálogo, busca, cards com marca aplicada (placeholder "Sem imagem" é a pendência já documentada da FIT-111 — 208 exercícios, 43 imagens importadas — não uma regressão nova).
- [Financeiro](13-personal-financeiro-1024.png): estados vazios reais ("Nenhuma cobrança cadastrada ainda"), nunca uma tabela administrativa genérica.

## Achado descartado (falso positivo do método de captura)

Uma primeira captura `fullPage: true` do dashboard em 360px mostrou a barra de navegação inferior (fixa) aparentemente sobrepondo o botão "+ Novo aluno". Refeito com captura de viewport real + rolagem manual: **o problema não existe** — é uma limitação conhecida do Chromium/Playwright ao renderizar elementos `position: fixed` numa captura de página inteira (o elemento fixo aparece "colado" num ponto do documento renderizado, não do viewport real). `.content` já reserva `padding-bottom` suficiente para a barra inferior (`AppShell.module.css`). Registrado aqui para não ser reaberto por engano numa futura revisão.

## Achado real corrigido durante esta revisão (dado de ambiente, não código)

O banco `fitos_dev` deste container nunca havia rodado a reconciliação de catálogo da FIT-127 (`ensurePlanCatalog`) — o `prisma/seed.ts` anterior falhou antes de chegar a essa etapa (e-mails de teste já existentes de sessões anteriores), então o onboarding do Personal chegou a mostrar, na primeira captura, os planos de geração 1 (preço zero, nomes "Essencial/Profissional/Ilimitado"). Corrigido rodando `npm run planos:seed-comerciais` (idempotente, o mesmo comando documentado como seguro em produção) — nenhuma linha de código foi alterada; era dado de ambiente local desatualizado, não um defeito da FIT-126/127.
