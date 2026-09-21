# Planos comerciais (FIT-090, EPIC-12)

Complementa `ASSINATURA-SAAS.md`. Implementação: `src/modules/saas-subscription/plans.ts`.

## Modelo

`CommercialPlan` (`prisma/migrations/20260921224616_add_commercial_plan`): catálogo de ofertas comerciais da assinatura SaaS, sem relação com nenhum tenant — é o mesmo catálogo para todos os personais.

- `code` identifica o produto ("essencial", "profissional") de forma estável entre versões.
- `version` incrementa a cada republicação de `(code, billingCycle)`.
- `billingCycle`: `MENSAL` ou `ANUAL`.
- `priceCents`/`currency` (`BRL`, único suportado nesta fase), `studentLimit`, `trialDays`, `discountPercent` (opcional, só para o ciclo anual).
- `active`/`effectiveFrom`/`effectiveTo`: uma versão inativa nunca é removida — permanece para referência histórica de assinaturas já contratadas (FIT-092).

## Versionamento por publicação, nunca por edição

`publishPlanVersion` é a única forma de escrita do módulo. Nunca faz `update` em `priceCents`/`studentLimit`/`trialDays`/`discountPercent` de uma versão existente — sempre desativa a versão ativa anterior (`active: false`, `effectiveTo: now`) e cria uma linha nova com `version` incrementado. Isso é o que garante "preservação das condições já contratadas" (critério de aceite da FIT-090): quando `SaasSubscription` passar a referenciar `CommercialPlan.id` (FIT-092), essa referência aponta para uma versão imutável para sempre, mesmo que uma versão nova seja publicada depois.

## Trava de concorrência

Índice único parcial `commercial_plans_active_code_billing_cycle` (`WHERE active = true`, adicionado à mão na migration — não representável em `schema.prisma`, mesmo padrão de `catalog_import_runs`) garante fisicamente no máximo uma versão vendável por `(code, billingCycle)`. Testado diretamente (duas linhas `active: true` para o mesmo par são rejeitadas com `P2002`), não via duas chamadas reais de `publishPlanVersion` em paralelo — republicar não é um erro (é o fluxo normal), só a colisão de duas leituras concorrentes do "ativo atual" seria, e isso depende de timing real não determinístico de forjar em teste.

## Plano/versão inativa não é vendável

`listSellablePlans`/`getSellablePlan` só retornam `active: true`. A garantia real contra vender uma versão inativa é o índice único (nunca duas ativas ao mesmo tempo) mais esse filtro — não depende só da consulta lembrar de filtrar.

## Hipótese comercial (não é decisão final de Produto)

Pacote pós-MVP, `01_FASE_2_1_MONETIZACAO.md`: Essencial R$ 39,90/mês (15 alunos), Profissional R$ 79,90/mês (50 alunos); anual com desconto hipotético (10% parcelado, 15% à vista). Semeada em `prisma/seed.ts` (dev, sintético) só para exercitar o módulo — nenhum valor aqui é preço definitivo; qualquer mudança real de tabela comercial é decisão de Produto e usa `publishPlanVersion`, nunca edição direta no banco.

## Fora de escopo desta história

Checkout, Asaas, e qualquer UI de contratação — nenhuma tela consome este catálogo ainda (chega na FIT-092). `SaasSubscription` (FIT-092) ainda não referencia `CommercialPlan` — a FK entra numa migration aditiva própria daquela história.
