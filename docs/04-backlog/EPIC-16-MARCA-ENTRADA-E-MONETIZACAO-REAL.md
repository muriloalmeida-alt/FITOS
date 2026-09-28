# EPIC-16 — Marca real, jornada de entrada e monetização com Asaas

## Origem

Documento de decisão de produto enviado por Murilo nesta sessão em 28/09/2026: `FITOS_REQUISITOS_ENTRADA_ONBOARDING_PAGAMENTOS_VISUAL.md`, anexado ao pacote de marca `FitOS_Marca_Proposta_v1(1).zip` (assets em `marca/` dentro do pacote). O próprio documento afirma, em conflito com decisões anteriores sobre rota inicial, preços, trial e apresentação visual: **prevalecem os requisitos deste documento**.

Isso supera o encerramento anterior do "EPIC-15" (Issue GitHub #130, "Conclusão verificável do FitOS — marca, produto e fechamento", fechado com aceite de Murilo em 27/09/2026 e a FIT-123 de aceite) — nunca existiu um `EPIC-15-*.md` neste diretório; o número foi usado só como label de Issue para o fechamento da cadeia de redesign (PRs #132–#144). Este novo pacote reabre exatamente esse tema (marca e monetização) com um padrão mais rigoroso: a marca aplicada até aqui (`BrandLogo.tsx`, FIT-117) é uma proposta interna nunca aprovada como oficial, e a monetização da FIT-122/ADR-010 deixou deliberadamente a integração de pagamento fora do escopo ("mecânica sem gateway, valor zero").

Issue GitHub: [EPIC-16 #148](https://github.com/muriloalmeida-alt/FITOS/issues/148).

## Levantamento prévio (feito antes de qualquer código)

- **Rotas**: `/` já é a landing comercial real (não resolve sessão); faltam `/conheca` e `/comecar` como nomes de rota. `/entrar` já existe com hero fotográfico full-bleed (`AuthHero`) — já atende boa parte do requisito de login. `/criar-conta` já é a escolha dos 3 caminhos (`OnboardingEntry.tsx`) — precisa de rota/redirect para `/comecar`.
- **Marca**: `BrandLogo.tsx` é SVG inline + wordmark em DOM, comentário explícito "proposta pendente de aprovação" — nunca um vetor aprovado. Paleta atual M3 é **navy + lime** (`docs/03-design/M3-DESIGN-TOKENS.md` → `tokens.css`); não há laranja em lugar nenhum — troca de paleta é ruptura completa do accent, exige novo ADR antes de tocar em `tokens.css` (regra "nunca cor fora do documentado"). Favicon/manifest/ícones PWA **não existem** hoje (nenhum arquivo, nenhuma declaração em `layout.tsx`) — trabalho novo, não retrofit.
- **Planos**: catálogo em `src/modules/billing/planCatalog.ts`, 4 slugs, **todos com `priceCents: 0`** (decisão deliberada do ADR-010) e `trialDays` sempre `null`. `studentLimit` não é imposto em nenhuma rota (ADR-010, item 6).
- **Asaas**: 22 arquivos citam "asaas", todos documentação/schema/comentário — **nenhuma chamada de rede real** hoje. `ADR-003` registrou Asaas como candidato; a prova técnica real (FIT-091, Issue #96) bloqueou por rede (`api.asaas.com`/`api-sandbox.asaas.com` recusados pelo proxy do ambiente de dev anterior) e ficou pausada dentro do EPIC-12 (#87). `SaasSubscription` (schema Prisma) tem `provider: String` desde a fundação (grava hoje o sentinela `"sem_integracao"`), mas não tem `externalSubscriptionId` nem qualquer campo de webhook.
- **Onboarding**: `/onboarding` (Individual/Livre) e `/onboarding-personal` (`PersonalOnboardingWizard.tsx`) já existem; vínculo de aluno já é por convite/ativação (FIT-015, preservado). Não existe um wizard genérico reutilizável em `src/shared/ui` — `PersonalOnboardingWizard` é ad-hoc da própria rota.
- **Design system**: `src/shared/ui/` é o único design system (M3), com tokens centralizados em `src/shared/design-system/tokens.css`; sem componente de Stepper/Wizard compartilhado hoje.

## Regras obrigatórias do documento (resumo — texto completo preservado fora do controle de versão, sem dado sensível)

- Revisar **toda a aplicação**, não só telas novas; adotar a nova marca em todos os perfis; corrigir a divergência de logo em homologação.
- Não aceitar controles nativos sem projeto visual, formulário administrativo, paredes de texto, cards genéricos ou desktop = mobile ampliado.
- Preservar os vetores da marca fornecidos — nunca redesenhar o monograma ou recriar o wordmark em texto.
- `/` resolve sessão (nunca landing pública); `/conheca` landing comercial; `/comecar` escolha de perfil; `/entrar` login.
- Onboarding guiado por perfil (Personal/Aluno/Livre), uma decisão por etapa, nunca cobrar o aluno convidado pelo vínculo.
- Preços reais com 30 dias grátis (tabela na Issue EPIC-16); versionamento de oferta por slug novo — **correção**: o registro original desta seção citava "ADR-005" por engano; ADR-005 documenta o versionamento de `TrainingPlan` (plano de treino do aluno), um domínio diferente. A regra correta para o catálogo comercial está em **ADR-013** (FIT-127) — nunca `UPDATE` de preço em slug ativo; usuários gratuitos existentes não são cobrados automaticamente.
- Integração real com Asaas dentro da experiência FitOS; nunca armazenar PAN/CVV; Pix/cartão/wallets sujeitos a prova técnica real; webhook autenticado, durável, idempotente, reconciliado; nunca cobrança real de produção para testes.
- PRs com documentação e código, migrations seguras, testes pertinentes, evidência visual; nunca merge direto na `main`; ativação de cobrança em produção requer aceite de Produto após validação em HML.

## Dependências e sequenciamento

- FIT-124 (marca) é transversal e não depende de rede externa — primeira a ser implementada.
- FIT-125 (rotas) depende parcialmente de FIT-124 (a nova `/conheca` já nasce com a marca aplicada).
- FIT-126 (onboarding) e FIT-127 (planos/preços) podem avançar em paralelo após FIT-125.
- FIT-128 (Asaas) depende de FIT-127 (catálogo de preços real em centavos) e exige reconfirmar conectividade de rede ao sandbox Asaas antes de planejar a integração (bloqueio documentado na FIT-091 era do ambiente de dev anterior, não necessariamente do ambiente atual/produção).
- FIT-129 (revisão visual integral e aceite) fecha o épico, depende de todas as anteriores.

## Histórias

| História | Resumo |
|---|---|
| FIT-124 | Nova identidade visual (marca azul/laranja) aplicada a toda a aplicação |
| FIT-125 | Rotas e sessão (`/`, `/conheca`, `/comecar`) |
| FIT-126 | Onboarding guiado por perfil (Personal/Aluno/Livre) |
| FIT-127 | Planos e preços reais + trial de 30 dias |
| FIT-128 | Integração real com Asaas (pagamentos, webhooks, assinaturas) |
| FIT-129 | Revisão visual integral, evidências e aceite final |

## Critérios de aceite

Descritos na íntegra em cada sub-issue GitHub (#149–#154) e no documento de decisão original — não duplicados aqui para nunca divergir da fonte.

## Estado

Em andamento — iniciado em 28/09/2026 com o levantamento acima e a criação das Issues.

- **FIT-124 (concluída, 28/09/2026)**: ADR-012 (ruptura de paleta navy+laranja), `tokens.css`/`M3-DESIGN-TOKENS.md` atualizados, `BrandLogo.tsx` reescrito para usar os vetores oficiais (`public/marca/`), favicon/manifest/ícones PWA novos (`src/app/icon.svg`, `apple-icon.png`, `manifest.ts`). Evidência visual real via Playwright em `/` e `/entrar` (360/768/1024/1440px). Telas autenticadas cobertas por teste (`AppShell.test.tsx`), evidência visual delas fica para a FIT-129. Suíte 1017/1017, gates limpos. Ver diário para detalhe completo.
- **FIT-125 (concluída, 28/09/2026)**: landing movida de `/` para `/conheca` (mesmo conteúdo, `LandingHeader` junto); `/criar-conta` renomeada para `/comecar` (redirect 308 permanente de compatibilidade em `next.config.mjs`, preserva query string); `/` reescrita do zero como resolvedor de sessão puro (`getServerSession` + `redirect()` para `/entrar` ou `/painel` — nunca decide o papel ali, quem decide é o próprio `/painel`). `src/proxy.ts` atualizado (`/comecar` no lugar de `/criar-conta`). Testado com servidor real: `/` sem sessão → 307 para `/entrar`; `/criar-conta` → 308 para `/comecar` (com e sem query string); evidência visual real de `/conheca` e `/comecar` via Playwright. Suíte 1021/1021, gates limpos.
- **FIT-127 (concluída, 28/09/2026 — antecipada antes da FIT-126, ver nota de sequenciamento abaixo)**: preços reais (Personal 20/50/Ilimitado R$49,90/69,90/99,90; FitOS Livre R$19,90) + 30 dias de trial, concedido uma única vez por tenant, nunca reiniciado numa troca de plano; `studentLimit` agora imposto de verdade (`createStudent`/`reactivateStudent`); downgrade abaixo do uso atual rejeitado. Migration nova (`trialEndsAt`/`trialUsedAt` em `SaasSubscription`). **ADR-013** registra o versionamento por slug novo (corrige a citação equivocada de "ADR-005" — domínio diferente). Suíte 1036/1036, gates limpos. Ver diário para o detalhe completo.

### Nota de sequenciamento: FIT-127 antes da FIT-126

A ordem lógica do documento de decisão lista FIT-126 (onboarding) antes da FIT-127 (planos/preços). Na prática, o passo de "seleção de plano" que a FIT-126 precisa adicionar ao onboarding do Personal (e o "dados necessários à cobrança"/confirmação de trial) depende de existir um catálogo real — construir essa tela contra os 4 planos de preço zero da geração 1 seria descartável assim que a FIT-127 landasse. Decisão de engenharia: inverter a ordem, implementar FIT-127 primeiro (puramente backend/dados, sem dependência de UI), e retomar a FIT-126 já com o catálogo real disponível — a UI de seleção de plano se escreve uma vez só, contra dados reais.
