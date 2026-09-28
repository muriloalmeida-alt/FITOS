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
- **PR2**: decidir onde/como coletar CPF/CNPJ (`PersonalProfile`, decisão de Murilo), migration, e só então o wiring real em `subscribeTenantToPlan`/`cancelSubscription` (ADR-010).

### FIT-128 — CPF/CNPJ coletado em PersonalProfile (28/09/2026)

Murilo confirmou: `PersonalProfile`, nunca `IndividualProfile` — quem paga a assinatura SaaS é sempre o personal, nunca o aluno/individual.

Implementado: `PersonalProfile.cpfCnpj` (`String?`, migration `20260928151012_add_cpf_cnpj_to_personal_profile` — nullable só para não fabricar dado retroativo em perfis já existentes, mesmo princípio de `IndividualProfile.termsAcceptedAt`); `src/shared/lib/cpfCnpj.ts` (máscara progressiva + validação real por dígito verificador de CPF/CNPJ, algoritmo da Receita Federal — não só contagem de dígitos); campo obrigatório na Etapa 2 do wizard (`/onboarding-personal`, junto de celular/CREF); `completePersonalOnboarding` valida e exige `cpfCnpj` em toda nova submissão.

### FIT-128 — wiring real em melhor esforço; webhook ainda pendente (28/09/2026)

Murilo decidiu o(s) meio(s) de pagamento: Pix, cartão de crédito e carteiras digitais — nunca um único meio fixo (`billingType: "UNDEFINED"` no Asaas).

`src/modules/billing/asaasClient.ts` ganhou os métodos de escrita (`createAsaasCustomer`, `findAsaasCustomerByCpfCnpj`, `createAsaasSubscription`, `updateAsaasSubscription`, `cancelAsaasSubscription`). `SaasSubscription.externalCustomerId`/`externalSubscriptionId` (migration `20260928152919_add_asaas_ids_to_saas_subscription`) guardam os ids reais quando a ligação tem sucesso.

`subscribeTenantToPlan`/`cancelSubscription` agora tentam a ligação real — mas em **modo de melhor esforço, deliberadamente nunca bloqueante**: qualquer falha (chave ausente, CPF/CNPJ ainda não informado, rede, resposta de erro do Asaas) é logada de forma saneada (`[FIT-128][assinatura-asaas]`, nunca a chave/corpo completo) e a função sempre volta para `NO_PAYMENT_PROVIDER`, exatamente o comportamento anterior. Motivo: os métodos de escrita do Asaas nunca foram exercidos contra a API real (só a leitura foi, no diagnóstico da FIT-128 original) — tornar o cadastro de um Personal dependente, de forma bloqueante, de uma API externa ainda não comprovada repetiria o erro de "integração no escuro" que este projeto sempre evitou.

Só tenta a ligação real com plano de preço real (`priceCents > 0`) e CPF/CNPJ já informado. Ao abrir o PR, só `PersonalProfile` coletava CPF/CNPJ — tenants `INDIVIDUAL` (FitOS Livre, plano pago real `individual-livre-v2`, R$19,90) ficariam inteiramente com `NO_PAYMENT_PROVIDER`. Murilo decidiu, ainda na mesma sessão: `IndividualProfile` deve coletar CPF/CNPJ também.

### FIT-128 — CPF/CNPJ estendido ao IndividualProfile; ligação real também para o FitOS Livre (28/09/2026)

`IndividualProfile.cpfCnpj` (`String?`, migration `20260928154554_add_cpf_cnpj_to_individual_profile`, mesmo tratamento de `PersonalProfile.cpfCnpj` — nullable só para não fabricar dado retroativo, obrigatório em toda nova submissão do onboarding "Treino sozinho"). Novo campo na Etapa 1 do wizard (`/onboarding`), junto de objetivo/experiência/disponibilidade. `tryEnsureAsaasSubscription` (`src/modules/billing/subscriptions.ts`) generalizado: busca o CPF/CNPJ em `PersonalProfile` ou `IndividualProfile` conforme `tenantType`, mesmo modo de melhor esforço, mesmas garantias de nunca bloquear o usuário.

**Ainda pendente**: confirmar o resultado real em homologação (ler os logs, mesmo padrão do diagnóstico original) antes de qualquer decisão de tornar esta ligação bloqueante; webhook de conciliação (ADR-010); o restante da prova técnica obrigatória do Asaas (`ASSINATURA-SAAS.md`) continua majoritariamente pendente.

### FIT-128 — achado real em homologação: catálogo de planos nunca reconciliado (28/09/2026)

Ao seguir o runbook de verificação (PR #166), Murilo reportou: nenhum plano pago disponível para escolher no onboarding real em homologação. Causa raiz: `railway.json` nunca rodou o seed do catálogo comercial no pré-deploy — só as migrations (confirmado desde o primeiro deploy, FIT-008: "Nenhum seed automático foi executado ou configurado"). A tabela `plans` de homologação estava vazia desde sempre; ninguém tinha notado porque nenhum onboarding real tinha sido concluído até o fim ali antes.

Corrigido a causa raiz: `railway.json` (`deploy.preDeployCommand`) agora roda `npm run planos:seed-comerciais` depois das migrations, a cada deploy — idempotente, sem chamada externa, seguro em qualquer ambiente (já documentado assim desde a FIT-122). O próprio deploy disparado pelo merge deste PR já reconcilia o catálogo em homologação.

- **FIT-129 (concluída dentro do que este sandbox permite, 28/09/2026)**: percorridas as três jornadas de entrada (Personal, FitOS Livre, Aluno convidado) ponta a ponta com contas reais criadas pela própria interface — nunca inseridas direto no banco (exceto o convite do aluno, gerado pela função de domínio real `generateInvitation`). Evidência visual commitada em `docs/06-engenharia/evidencias/FIT-129/`, cobrindo as larguras exigidas (360/768/1024/1440px) para login, `/conheca`, `/comecar`, cada onboarding, checkout/assinatura e os três dashboards. Nenhuma mudança de código de produção foi necessária — a marca (FIT-124), as rotas (FIT-125), o onboarding guiado (FIT-126) e o catálogo real (FIT-127) já estavam corretos; um achado real (banco de dev deste sandbox nunca reconciliado com o catálogo da FIT-127) foi corrigido rodando o próprio script idempotente já existente (`npm run planos:seed-comerciais`), sem tocar em código. Relatório final consolidado do épico em `docs/06-engenharia/RELATORIO-FINAL-EPIC-16.md` — **não declara o épico encerrado**: FIT-128 continua pausada e nenhuma validação em homologação real (Railway) foi possível a partir deste sandbox (sem credenciais de acesso).

### FIT-128 — causa raiz real confirmada: override manual no painel do Railway (28/09/2026)

Depois do PR #166 mesclado e implantado (commit/branch confirmados corretos), o plano pago ainda não aparecia no onboarding. Causa raiz real: o "Pre-Deploy Command" do serviço `fitos-web-hml` estava configurado manualmente no painel do Railway, sobrepondo `railway.json` — o arquivo versionado neste repositório nunca foi, na prática, a fonte de verdade do pré-deploy desse serviço. Murilo corrigiu o valor no painel e disparou um novo deploy; confirmado por evidência visual que os planos pagos do Personal agora aparecem no passo 3 do onboarding. Detalhe completo e o risco operacional geral (qualquer campo de `railway.json` pode estar sujeito ao mesmo tipo de override) registrados em `AMBIENTES-E-DEPLOY.md` e no diário.

### FIT-128 — ligação real ao Asaas Sandbox confirmada de ponta a ponta (28/09/2026)

Com o catálogo corrigido, Murilo concluiu o runbook até o fim: cadastro real de teste (Personal, plano pago) em homologação. Confirmado por dois canais independentes — cliente visível no painel do Asaas Sandbox e a linha de log `[FIT-128][assinatura-asaas] sucesso: cliente e assinatura ligados ao Asaas Sandbox.` — que a criação real de cliente e assinatura funciona. Detalhe completo em `ASSINATURA-SAAS.md`, `ADR-003-ASAAS-COMO-CANDIDATO.md` e no diário.

### FIT-128 — webhook de conciliação implementado (ADR-010, item c) (28/09/2026)

Implementado `POST /api/webhooks/asaas` — recebe eventos reais de pagamento do Asaas (pago, atrasado) e atualiza `SaasSubscription.status` de acordo, autenticado por token compartilhado. Fecha o item (c) da ADR-010 no código; a verificação contra uma entrega real do Asaas (não só o contrato público documentado) é o próximo passo que depende de acesso ao Railway/Asaas — ver `RUNBOOK-VERIFICACAO-WEBHOOK-ASAAS-HOMOLOGACAO.md`. Detalhe completo em `ASSINATURA-SAAS.md` e `ADR-003-ASAAS-COMO-CANDIDATO.md`. O restante da prova técnica obrigatória do Asaas (renovação, falha/inadimplência/recuperação, cancelamento, reconciliação completa, meios de pagamento reais disponíveis à conta, custo/compatibilidade Railway) continua não exercido.

### FIT-128 — checkout embutido no FitOS: cartão de crédito (28/09/2026)

Murilo decidiu: "toda a transação deve ocorrer no FitOS e o Asaas deve ser o gateway. No FitOS o cliente deve completar 100% do processo de checkout" — nunca um redirecionamento para uma página do Asaas. Implementado o checkout de cartão de crédito (tokenização + vínculo à assinatura para cobrança automática recorrente), reaproveitado no onboarding do Personal, do FitOS Livre e em `/painel/assinatura`. Apple Pay/Google Pay, também pedidos por Murilo para esta v1, ficam registrados como pendência explícita — sem confirmação de que o Asaas aceita esses tokens fora do checkout hospedado dele, construir agora seria adivinhar um contrato não verificado. Pix e boleto ficam fora do escopo desta v1. Detalhe completo em `ASSINATURA-SAAS.md` e `ADR-003-ASAAS-COMO-CANDIDATO.md`; verificação real pendente em `RUNBOOK-VERIFICACAO-CHECKOUT-CARTAO-ASAAS-HOMOLOGACAO.md`.

### Nota de sequenciamento: FIT-127 antes da FIT-126

A ordem lógica do documento de decisão lista FIT-126 (onboarding) antes da FIT-127 (planos/preços). Na prática, o passo de "seleção de plano" que a FIT-126 precisa adicionar ao onboarding do Personal (e o "dados necessários à cobrança"/confirmação de trial) depende de existir um catálogo real — construir essa tela contra os 4 planos de preço zero da geração 1 seria descartável assim que a FIT-127 landasse. Decisão de engenharia: inverter a ordem, implementar FIT-127 primeiro (puramente backend/dados, sem dependência de UI), e retomar a FIT-126 já com o catálogo real disponível — a UI de seleção de plano se escreve uma vez só, contra dados reais.
