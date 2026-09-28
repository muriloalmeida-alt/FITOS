# ADR-013 — Versionamento de planos comerciais por novo slug, nunca `UPDATE` de preço em slug ativo

## Status

Aceito (28/09/2026, FIT-127/EPIC-16).

## Correção de referência

O documento de decisão do EPIC-16 e a Issue da FIT-127 citaram inicialmente "ADR-005" como precedente para esta regra. **Isso estava errado**: `ADR-005-VERSIONAMENTO-DE-PLANOS.md` documenta o versionamento de `TrainingPlan` (o **plano de treino** atribuído a um aluno, por cópia física em `PlanAssignment` — FIT-030/033) — um domínio inteiramente diferente do catálogo comercial de planos de assinatura (`Plan`/`SaasSubscription`, FIT-090/122). A coincidência é só o nome em português ("plano"). Este ADR-013 é o registro correto e específico para o catálogo comercial; nenhuma mudança foi feita em ADR-005 nem em `TrainingPlan`.

## Contexto

`ensurePlanCatalog` (`src/modules/billing/planCatalog.ts`) reconcilia a tabela `plans` por `upsert(where: { slug })` — ou seja, **hoje** rodar essa função com um `priceCents` novo para um `slug` já existente **sobrescreve o preço em produção**, inclusive para tenants que já têm `SaasSubscription.planId` apontando para aquele mesmo `Plan`. Isso é uma alteração retroativa e silenciosa do valor cobrado de assinantes existentes — inaceitável para qualquer sistema de cobrança real, e contraria explicitamente o requisito do EPIC-16: "Não cobrar usuários gratuitos existentes automaticamente: pedir nova escolha e aceite."

Os quatro slugs do MVP (`personal-essencial`, `personal-profissional`, `personal-ilimitado`, `individual-livre`) foram criados com `priceCents: 0` por decisão deliberada (ADR-010). A FIT-127 precisa introduzir os preços reais (R$49,90/69,90/99,90/19,90) sem sobrescrever esses quatro slugs.

## Decisão

Preços/condições comerciais nunca mudam por `UPDATE` num `slug` já existente e ativo. Uma mudança de oferta sempre:

1. Cria um **novo slug** no `PLAN_CATALOG` (ex.: `personal-essencial` → `personal-20`, refletindo também o novo nome comercial "Personal 20" da tabela do EPIC-16) com o preço/condições novos e `active: true`.
2. Marca o slug antigo como `active: false` no próprio `PLAN_CATALOG` (nunca remove a entrada — `ensurePlanCatalog` nunca apaga linha da tabela `plans`, só deixa de oferecer para nova contratação/troca).

Consequência automática, sem código extra: um tenant com `SaasSubscription.planId` apontando para o slug antigo continua exatamente na mesma condição (mesmo preço, hoje R$0) até que **ele mesmo** escolha trocar de plano (`subscribeTenantToPlan`, que já valida `plan.active` para nova contratação/troca) — nunca uma migração de dados o move automaticamente. Isso é, por construção, a mesma coisa que "pedir nova escolha e aceite".

`PlanCatalogEntry.active` foi adicionado à interface (antes inexistente — todo plano do catálogo era implicitamente `active: true`, já que `ensurePlanCatalog` nunca escrevia esse campo e o schema tem `@default(true)`).

## Consequências

- `PLAN_CATALOG` cresce (nunca encolhe) a cada mudança de preço — aceitável, é só uma lista estática de poucos itens.
- Qualquer relatório/consulta de "planos disponíveis" já filtra por `active: true` (`listActivePlansForAudience`) — nenhuma mudança necessária ali.
- Trial (`trialDays`) segue a mesma regra: o slug antigo (sem trial) nunca ganha trial retroativamente; só o slug novo o tem.
