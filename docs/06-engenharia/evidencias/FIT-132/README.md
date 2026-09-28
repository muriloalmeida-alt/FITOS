# Evidências — FIT-132 (PR2, pacote visual 2026 — entrada e onboarding)

Capturas reais via Playwright contra `npm run dev` deste sandbox (Turbopack, sem banco/sessão — as três rotas abaixo são públicas), nas 5 larguras exigidas pelo pacote: 360, 390, 768, 1024 e 1440px. Cada arquivo segue o padrão `<rota>-<largura>.png`.

## `/entrar`

- [360](entrar-360.png) · [390](entrar-390.png) · [768](entrar-768.png) · [1024](entrar-1024.png) · [1440](entrar-1440.png)
- Foto `scene-solo` como banda superior também no compacto (antes desta rodada, o painel fotográfico só existia em desktop) — logo `BrandLogo background="photo"` sem tarja de fundo, headline em duas cores ("Movimento começa" branco + "com um plano." laranja), cartão de login sobreposto por cima do rodapé da foto.
- Confere lado a lado com `prints-mobile/tela-01.png` e `prints-desktop/tela-01.png` do pacote — mesma composição (foto + headline + cartão sobreposto no mobile; painel fotográfico fixo + formulário à direita no desktop).

## `/conheca`

- [360](conheca-360.png) · [390](conheca-390.png) · [768](conheca-768.png) · [1024](conheca-1024.png) · [1440](conheca-1440.png)
- Cabeçalho branco (era chrome escuro antes desta rodada) sticky sobre a hero fotográfica full-bleed (`scene-runner`, gradiente lateral escuro→transparente da esquerda para a direita). Restante da página migrado das superfícies "chrome" escuras para as superfícies editoriais claras (`surface-editorial`, ADR-014) — mesmo conteúdo/copy de antes, só a paleta muda.
- Confere com `prints-mobile/tela-02.png`/`prints-desktop/tela-02.png`: hero full-bleed com texto à esquerda, cartões claros abaixo.

## `/comecar`

- [360](comecar-360.png) · [390](comecar-390.png) · [768](comecar-768.png) · [1024](comecar-1024.png) · [1440](comecar-1440.png)
- Os três caminhos (Personal/Convite/Livre) agora são cartões fotográficos (`PathPhotoCard`, novo componente) — `scene-program`/`scene-coach`/`scene-solo`, rótulo "NN / CATEGORIA" em laranja, gradiente inferior, seta decorativa. `ConviteCodeForm` real embutido no segundo cartão (não é um link, é um formulário funcional — os tokens `--fitos-color-primary`/`surface`/`outline` do cartão são redefinidos localmente para continuar legível sobre a foto).
- Confere com `prints-mobile/tela-03.png`/`prints-desktop/tela-03.png`: três cartões fotográficos, empilhados no mobile e em linha no desktop (breakpoint em 720px).

## Pendências explícitas (não escondidas)

- **`/onboarding-personal` e `/onboarding` sem captura real**: as duas exigem sessão autenticada e consulta real ao banco (`getServerSession`, `prisma.tenant.findUniqueOrThrow`, `listActivePlansForAudience`) — este ambiente de execução não tem PostgreSQL nem Docker disponíveis (mesma limitação já registrada em FIT-131 #170). O painel fotográfico das duas (`scene-trainer`/`scene-solo`) foi implementado e cobre o desktop; falta confirmar visualmente contra homologação ou uma sessão com banco local.
- **Painel fotográfico das duas rotas acima, no mobile**: escopo reduzido ao desktop nesta rodada — o print mobile (tela 04) usa uma composição "inset"/cantos arredondados diferente da banda de borda a borda que `/entrar` já ganhou, e construir as duas variantes ao mesmo tempo fugia do orçamento desta rodada. Registrado no código (`onboarding-personal/page.module.css`, `onboarding/page.module.css`) e aqui, não silenciado.
- **`PlanOptionCard`** (seleção de plano, usada dentro das duas rotas acima) não tem captura própria pela mesma razão — mas a mudança visual (cartão navy elevado no plano *selecionado*, nunca um "mais escolhido" fabricado) está coberta por teste de componente (`PlanOptionCard.test.tsx`).

## Achado de método de captura (não é defeito de produto)

Capturas `fullPage: true` de `/entrar` em 1440px, feitas com o viewport padrão do script (900px de altura), mostraram o fim do headline ("com um plano.") bem próximo da borda inferior da imagem exportada — o Chromium recalcula `min-height: 100vh` para a altura *nova* que o `fullPage` usa internamente durante a captura, então o hero (`min-height: 100vh` em desktop) cresce um pouco mais do que os 900px do viewport real. Confirmado inspecionando o layout fora do modo `fullPage`: o texto tem a mesma folga inferior (`padding-bottom`) de sempre num viewport fixo. Mesma classe de artefato de captura já documentada em FIT-129 (elemento com dimensão relativa ao viewport, capturado por uma ferramenta que altera o viewport). Não é um problema real, registrado para não ser reaberto por engano.

O selo circular preto com "N" visível em alguns cantos das capturas é o indicador de ferramentas de desenvolvimento do Next.js (Turbopack, modo dev) — não existe em build de produção, não é elemento da interface.
