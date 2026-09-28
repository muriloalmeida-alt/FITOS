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
- FIT-128 (Asaas) depende de FIT-127 (catálogo de preços real em centavos) e exige reconfirmar conectividade de rede ao sandbox Asaas antes de planejar a integração (bloqueio documentado na FIT-091 era do ambiente de dev anterior, não necessariamente do ambiente atual/produção). **Reconfirmado em 28/09/2026, nesta sessão: ainda bloqueado** — ver seção "FIT-128 — bloqueio de rede reconfirmado" abaixo.
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
- **FIT-127 (concluída, 28/09/2026 — antecipada antes da FIT-126, ver nota de sequenciamento abaixo)**: preços reais (Personal 20/50/Ilimitado R$49,90/69,90/99,90; FitOS Livre R$19,90) + 30 dias de trial, concedido uma única vez por tenant, nunca reiniciado numa troca de plano; `studentLimit` agora imposto de verdade (`createStudent`/`reactivateStudent`); downgrade abaixo do uso atual rejeitado. Migration nova (`trialEndsAt`/`trialUsedAt` em `SaasSubscription`). **ADR-013** registra o versionamento por slug novo (corrige a citação equivocada de "ADR-005" — domínio diferente). Suíte 1036/1036, gates limpos. PR #158 mesclado. Ver diário para o detalhe completo.
- **FIT-126 (concluída, 28/09/2026 — retomada após a FIT-127 com o catálogo real disponível)**: seleção de plano real (com trial) adicionada ao onboarding do Personal (nova sub-etapa "Escolha seu plano", `/onboarding-personal`) e ao do FitOS Livre (`/onboarding` virou um wizard de 2 etapas, antes um único formulário sem etapa de plano). Extraído um wizard genérico reutilizável em `src/shared/ui` (`WizardProgress`/`useUnsavedChangesGuard` em `Wizard.tsx`, `PlanOptionCard.tsx`) — usado pelos dois perfis. Onboarding do Aluno convidado (convite/ativação, FIT-015) foi revisado e **já atendia** os critérios do pacote (recuperação clara para token inválido/expirado/reutilizado, nunca cobra o aluno pelo vínculo) — nenhuma mudança de código foi necessária ali. Ver `ONBOARDING-PERSONAL.md` para o detalhe completo, incluindo as pendências reais explícitas (contas existentes não migradas retroativamente; "plano do profissional como contexto" na tela de ativação do aluno, deliberadamente deferido por ser marcado como opcional no próprio pacote). PR #159 mesclado.

### FIT-128 — bloqueio de rede reconfirmado (28/09/2026)

Antes de escrever qualquer código de integração, reconfirmado nesta sessão, neste ambiente (diferente do ambiente de dev que bloqueou a FIT-091):

```
curl https://api-sandbox.asaas.com/v3/customers → CONNECT tunnel failed, 403 (connect_rejected, política do proxy da organização)
curl https://api.asaas.com/v3/customers        → CONNECT tunnel failed, 403 (connect_rejected, política do proxy da organização)
curl https://api.mercadopago.com                → CONNECT tunnel failed, 403 (connect_rejected, política do proxy da organização)
```

O proxy de saída deste ambiente (`/root/.ccr/README.md`) opera por lista de permissão (`noProxy` cobre só domínios conhecidos: npm/PyPI/crates/Anthropic/etc.) — qualquer domínio de terceiro fora dessa lista, incluindo **tanto o candidato primário (Asaas) quanto o fallback documentado (Mercado Pago)**, é recusado pelo gateway da organização (`connect_rejected`, HTTP 403 no `CONNECT`), não por instabilidade de rede. Isso não é um problema específico do Asaas nem algo que uma nova tentativa resolva — é uma política de rede no nível do ambiente, fora do alcance de qualquer mudança de código nesta sessão.

**Consequência**: a "prova técnica obrigatória do Asaas" (`ASSINATURA-SAAS.md`, seção própria — criar cliente/assinatura reais, autenticar webhooks, validar renovação/inadimplência, reconciliar estado) **não pode ser executada a partir deste sandbox**, com nenhum dos dois provedores candidatos. Construir a integração "no escuro" (sem nenhuma chamada real validada) contradiz diretamente a exigência do próprio documento de decisão de nunca aceitar prova enganosa nem declarar sucesso com falhas reais — e o precedente já aberto desta base (FIT-091/EPIC-12, ADR-003) é pausar explicitamente nesse caso, não fabricar uma integração não verificável.

FIT-128 fica **pausada por bloqueio real de rede**, mesmo padrão da FIT-091 — decisão sobre como proceder (mecânica sem chamada real vs. aguardar acesso de rede vs. executar a prova técnica fora deste sandbox) posta a Murilo. **Decisão de Murilo (28/09/2026)**: seguir para a FIT-129 agora, mantendo a FIT-128 pausada como está — não construir mecânica no escuro nem aguardar antes de avançar as demais Histórias.

### FIT-128 — retomada com diagnóstico temporário via Railway (28/09/2026)

Murilo autorizou formalmente investigar/testar em homologação e Sandbox (nunca produção), com acesso próprio ao Railway e à API do Asaas via um GPT que não escreve em Git. Sequência real desta retomada:

1. Runbook autocontido (`RUNBOOK-DIAGNOSTICO-ASAAS-HOMOLOGACAO.md`, PR #162) para o GPT confirmar a variável no Railway e rodar um `GET` de leitura manual, saneando o resultado.
2. Murilo pediu, em seguida, algo mais direto: um diagnóstico **automatizado**, executado uma única vez na inicialização do `fitos-web-hml`, só em homologação — em vez de depender de alguém rodar `curl` manualmente. Implementado em `src/modules/billing/asaasSandboxDiagnostic.ts` (chamado por `src/instrumentation.ts`, o hook `register()` do Next.js, estável desde a v15): `GET https://api-sandbox.asaas.com/v3/customers?limit=1`, header `access_token` com a variável já existente `API_ASAAS`, timeout de 15s, gate por `NEXT_PUBLIC_APP_ENV === "homologacao"`. Log só de status/duração/formato da resposta em sucesso; código/descrição saneados do próprio Asaas ou categoria de falha de rede em erro — nunca a chave, headers, corpo completo ou dado de cliente. Nenhum endpoint público.
3. Runbook atualizado para o novo fluxo: ler a linha `[FIT-128][diagnostico-asaas]` no log do deploy (caminho principal) em vez de rodar `curl` manualmente (mantido como caminho alternativo/checagem cruzada).
4. **Explicitamente temporário**: este diagnóstico não é o adaptador real — será removido num PR próprio depois que o resultado (sucesso ou causa exata de falha) for lido nos logs de homologação e reportado.

Testes: `asaasSandboxDiagnostic.test.ts` (8 testes: nunca chama a rede fora de homologação/sem `API_ASAAS`, sucesso loga sem a chave, formato de listagem inválido é reportado como tal, erro 401 loga só código/descrição saneados, erro de DNS/timeout loga só a categoria, nunca lança mesmo com corpo não-JSON) e `instrumentation.test.ts` (2 testes: dispara sem aguardar a promise, nunca dispara no runtime edge). Suíte completa: 1063/1063. `tsc --noEmit`/`eslint .`/`npm run build`/`npm audit --omit=dev` limpos.

### FIT-128 — conectividade/autenticação confirmadas; cliente HTTP real; CPF/CNPJ pendente (28/09/2026)

Murilo confirmou o resultado real do diagnóstico a partir do log de `fitos-web-hml` em homologação: `HTTP 200` em `497ms`, formato de listagem válido — **conectividade e autenticação com o Asaas Sandbox provadas empiricamente**, e autorizou seguir com a integração real.

Antes de escrever qualquer chamada de criação de cliente/assinatura, foi verificado se o schema já tinha o campo `cpfCnpj` que o Asaas exige em `POST /v3/customers`: `grep -in "cpf\|cnpj\|taxId" prisma/schema.prisma` não encontrou nada em `User`, `Tenant`, `PersonalProfile` ou `IndividualProfile` — nenhum onboarding hoje coleta CPF/CNPJ. Achado reportado a Murilo, que decidiu dividir o trabalho em 2 PRs:

- **PR1 (este)**: remove o diagnóstico temporário (`asaasSandboxDiagnostic.ts`/`instrumentation.ts` e seus testes) e cria `src/modules/billing/asaasClient.ts` — cliente HTTP real reutilizável, generalizando a mecânica já provada (header `access_token`, `User-Agent: FitOS/1.0`, base URL do Sandbox, timeout de 15s, erro sanitizado em `AsaasApiError`). `listAsaasCustomers` é a única chamada exercida contra o Asaas real até agora. **Nenhum wiring**: `subscribeTenantToPlan`/`cancelSubscription` continuam com `NO_PAYMENT_PROVIDER` — este PR não cria cliente, assinatura nem cobrança nenhuma.
- **PR2 (futuro, ainda não iniciado)**: decidir onde/como coletar CPF/CNPJ (provavelmente `PersonalProfile`, já que quem paga a assinatura SaaS é sempre o personal — decisão de Murilo, não deste PR), migration, e só então o wiring real em `subscribeTenantToPlan`/`cancelSubscription` (ADR-010).

### FIT-128 — CPF/CNPJ coletado em PersonalProfile; wiring real ainda pendente (28/09/2026)

Murilo confirmou: `PersonalProfile`, nunca `IndividualProfile` — quem paga a assinatura SaaS é sempre o personal, nunca o aluno/individual.

Implementado: `PersonalProfile.cpfCnpj` (`String?`, migration `20260928151012_add_cpf_cnpj_to_personal_profile` — nullable só para não fabricar dado retroativo em perfis já existentes, mesmo princípio de `IndividualProfile.termsAcceptedAt`); `src/shared/lib/cpfCnpj.ts` (máscara progressiva + validação real por dígito verificador de CPF/CNPJ, algoritmo da Receita Federal — não só contagem de dígitos); campo obrigatório na Etapa 2 do wizard (`/onboarding-personal`, junto de celular/CREF); `completePersonalOnboarding` valida e exige `cpfCnpj` em toda nova submissão.

**Ainda pendente, para uma História separada**: o wiring real — chamar `asaasClient.ts` de dentro de `subscribeTenantToPlan`/`cancelSubscription` para criar cliente/assinatura de fato no Asaas (ADR-010). Falta decidir o(s) meio(s) de pagamento (`billingType`: boleto/cartão/Pix/todos) antes disso, e o webhook de conciliação continua não iniciado. Contas existentes que não reabrirem o onboarding continuam com `cpfCnpj: null`.

- **FIT-129 (concluída dentro do que este sandbox permite, 28/09/2026)**: percorridas as três jornadas de entrada (Personal, FitOS Livre, Aluno convidado) ponta a ponta com contas reais criadas pela própria interface — nunca inseridas direto no banco (exceto o convite do aluno, gerado pela função de domínio real `generateInvitation`). Evidência visual commitada em `docs/06-engenharia/evidencias/FIT-129/`, cobrindo as larguras exigidas (360/768/1024/1440px) para login, `/conheca`, `/comecar`, cada onboarding, checkout/assinatura e os três dashboards. Nenhuma mudança de código de produção foi necessária — a marca (FIT-124), as rotas (FIT-125), o onboarding guiado (FIT-126) e o catálogo real (FIT-127) já estavam corretos; um achado real (banco de dev deste sandbox nunca reconciliado com o catálogo da FIT-127) foi corrigido rodando o próprio script idempotente já existente (`npm run planos:seed-comerciais`), sem tocar em código. Relatório final consolidado do épico em `docs/06-engenharia/RELATORIO-FINAL-EPIC-16.md` — **não declara o épico encerrado**: FIT-128 continua pausada e nenhuma validação em homologação real (Railway) foi possível a partir deste sandbox (sem credenciais de acesso).

### Nota de sequenciamento: FIT-127 antes da FIT-126

A ordem lógica do documento de decisão lista FIT-126 (onboarding) antes da FIT-127 (planos/preços). Na prática, o passo de "seleção de plano" que a FIT-126 precisa adicionar ao onboarding do Personal (e o "dados necessários à cobrança"/confirmação de trial) depende de existir um catálogo real — construir essa tela contra os 4 planos de preço zero da geração 1 seria descartável assim que a FIT-127 landasse. Decisão de engenharia: inverter a ordem, implementar FIT-127 primeiro (puramente backend/dados, sem dependência de UI), e retomar a FIT-126 já com o catálogo real disponível — a UI de seleção de plano se escreve uma vez só, contra dados reais.
