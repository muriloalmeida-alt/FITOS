# Assinatura SaaS

## Mecânica implementada (FIT-122) — preços e trial reais desde a FIT-127; gateway ainda não integrado

Decisão original (FIT-122/ADR-010): construir toda a mecânica de negócio (catálogo de planos, contratar, trocar, cancelar) antes do gateway real, com preço zero. A FIT-127/EPIC-16 substituiu os preços zero por valores reais e trial de 30 dias — o gateway (Asaas) continua fora de escopo, agora explicitamente a FIT-128.

- `Plan` (`src/modules/billing/plans.ts`): catálogo configurável, nunca valor fixo em código — `audience` (reaproveita `TenantType`), `priceCents`, `billingCycle`, `studentLimit` (**imposto desde a FIT-127** — ver abaixo), `trialDays`, `active`. Um plano retirado (`active=false`) nunca é oferecido de novo, mas quem já o assina continua com ele — mudar preço/limite é sempre criar um `slug` novo, nunca editar a linha existente (**ADR-013**, que corrige a citação equivocada de "ADR-005" nos documentos anteriores do EPIC-16 — ADR-005 é sobre versionamento de `TrainingPlan`, um domínio inteiramente diferente).
- `SaasSubscription` (reservada desde a FIT-007, usada de verdade desde a FIT-122): uma linha por tenant (`tenantId @unique`), reaproveitada entre contratação/troca/reativação — nunca um histórico de linhas. `provider` grava o sentinela `NO_PAYMENT_PROVIDER = "sem_integracao"` (`src/modules/billing/subscriptions.ts`) enquanto nenhum gateway existir. **Novos campos (FIT-127)**: `trialEndsAt`/`trialUsedAt` — ver "Trial de 30 dias" abaixo.
- `subscribeTenantToPlan`/`cancelSubscription` (`src/modules/billing/subscriptions.ts`): validam `plan.audience === tenantType`, `plan.active` e (FIT-127) que a contagem atual de alunos ativos do tenant não excede `plan.studentLimit` do plano de destino (`LIMITE_ABAIXO_DO_USO_ATUAL` — rejeita downgrade abaixo do uso atual); cada mudança grava `AuditEvent` (`ASSINATURA_CONTRATADA`/`ASSINATURA_CANCELADA`); cancelar é idempotente (nunca sobrescreve motivo/data da primeira vez).
- `src/modules/billing/planCatalog.ts`: catálogo oficial. **Geração 1** (FIT-122, preço zero): `personal-essencial`/`personal-profissional`/`personal-ilimitado`/`individual-livre` — desativados pela FIT-127 (`active: false`), nunca removidos; quem já assina continua exatamente como está. **Geração 2** (FIT-127, preços reais + 30 dias de trial): `personal-20` (R$49,90, até 20 alunos), `personal-50` (R$69,90, até 50), `personal-ilimitado-v2` (R$99,90, sem limite), `individual-livre-v2` (R$19,90, FitOS Livre). Reconciliado por upsert idempotente (`ensurePlanCatalog`), reaproveitado tanto por `scripts/seed-planos-comerciais.ts` (`npm run planos:seed-comerciais`, seguro em produção) quanto por `prisma/seed.ts` (dev).
- **Limite de alunos, agora imposto (FIT-127)**: `createStudent`/`reactivateStudent` (`src/modules/students/students.ts`) rejeitam (`LIMITE_DE_ALUNOS_ATINGIDO`) quando o tenant tem assinatura `ATIVA` num plano com `studentLimit` definido e a contagem de alunos `ATIVO` já atingiu esse limite. Sem assinatura, ou com plano `studentLimit: null`, nunca bloqueia — impor um limite sem plano contratado seria uma regra nova não pedida.
- **Trial de 30 dias, concedido uma única vez por tenant (FIT-127)**: `trialUsedAt` é gravado na primeira vez que qualquer plano com `trialDays` é concedido a um tenant e nunca mais é limpo — uma troca de plano posterior (mesmo para outro plano com trial) nunca concede um novo trial nem reinicia a contagem (`trialEndsAt` da troca é copiado do valor já existente, não recalculado). Backend decide a elegibilidade sozinho — nenhuma escolha de UI concede ou nega trial.
- Rotas: `GET`/`POST /api/tenancy/minha-assinatura` (consultar/contratar/trocar), `POST /api/tenancy/minha-assinatura/cancelar` — todas atrás de `requireSubscriber()` (`PERSONAL` ou `INDIVIDUAL`, nunca `ALUNO`). UI em `/painel/assinatura` — já lê nome/preço/trial dinamicamente da tabela `plans`, nenhuma mudança de UI foi necessária para os novos preços aparecerem.
- **Nunca implementado aqui** (permanece na fila, agora FIT-128/EPIC-16): gateway real, meios de pagamento, renovação automática, recuperação de pagamento/inadimplência (não pode existir sem cobrança real), ledger/conciliação.
- **Ainda pendente, fora do escopo desta História**: wiring de seleção de plano dentro do onboarding guiado (FIT-126, que agora reaproveita este catálogo real em vez de placeholders).

## Separação obrigatória

| Fluxo | Responsável pelo pagamento | Processamento no MVP |
|---|---|---|
| Assinatura FitOS | Personal trainer | Sim, após provedor aprovado |
| Cobranças dos alunos | Aluno para o personal | Não; apenas controle manual |

Entidades, estados e webhooks da assinatura não podem alterar diretamente `StudentCharge`.

## Candidato

Asaas é candidato primário; Mercado Pago é fallback. A aprovação depende de prova em sandbox.

## Prova técnica obrigatória do Asaas

- criar cliente e assinatura com dados fictícios;
- ativar e consultar situação;
- receber e autenticar webhooks;
- garantir idempotência e tolerância a reenvio/desordem;
- validar renovação bem-sucedida;
- validar falha, inadimplência e recuperação;
- cancelar sem apagar histórico;
- reconciliar estado local com o provedor;
- validar cartão recorrente e meios locais realmente disponíveis à conta;
- confirmar operação, custos e compatibilidade com Railway.

## Estado de acesso

As regras de teste grátis, carência, suspensão e reativação ainda são decisão comercial pendente. Até sua definição, a arquitetura não deve inventar bloqueio automático.

## Critério de decisão

- aprovado: ADR-003 muda para `Aceito`;
- reprovado: prova equivalente com Mercado Pago;
- inconclusivo: cobrança produtiva bloqueada.

Chaves ficam somente em variáveis protegidas; payloads são minimizados e webhooks nunca são confiados sem validação.
