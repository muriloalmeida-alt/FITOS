# Assinatura SaaS

## Mecânica implementada (FIT-122) — gateway ainda não integrado

Decisão explícita de Produto: construir toda a mecânica de negócio (catálogo de planos, contratar, trocar, cancelar) antes do gateway real, com preço zero. Ver `ADR-010-MECANICA-DE-ASSINATURA-SEM-GATEWAY.md` para o raciocínio completo.

- `Plan` (`src/modules/billing/plans.ts`): catálogo configurável, nunca valor fixo em código — `audience` (reaproveita `TenantType`), `priceCents`, `billingCycle`, `studentLimit` (informativo, sem imposição), `trialDays`, `active`. Um plano retirado (`active=false`) nunca é oferecido de novo, mas quem já o assina continua com ele ("versionamento de oferta": mudar preço/limite é criar um `slug` novo, nunca editar a linha existente).
- `SaasSubscription` (reservada desde a FIT-007, agora usada de verdade): uma linha por tenant (`tenantId @unique`), reaproveitada entre contratação/troca/reativação — nunca um histórico de linhas. `provider` grava o sentinela `NO_PAYMENT_PROVIDER = "sem_integracao"` (`src/modules/billing/subscriptions.ts`) enquanto nenhum gateway existir.
- `subscribeTenantToPlan`/`cancelSubscription` (`src/modules/billing/subscriptions.ts`): validam `plan.audience === tenantType` e `plan.active`; cada mudança grava `AuditEvent` (`ASSINATURA_CONTRATADA`/`ASSINATURA_CANCELADA`); cancelar é idempotente (nunca sobrescreve motivo/data da primeira vez).
- `src/modules/billing/planCatalog.ts`: catálogo oficial (4 planos: `personal-essencial`/`personal-profissional`/`personal-ilimitado`/`individual-livre`), reconciliado por upsert idempotente (`ensurePlanCatalog`), reaproveitado tanto por `scripts/seed-planos-comerciais.ts` (`npm run planos:seed-comerciais`, seguro em produção) quanto por `prisma/seed.ts` (dev).
- Rotas: `GET`/`POST /api/tenancy/minha-assinatura` (consultar/contratar/trocar), `POST /api/tenancy/minha-assinatura/cancelar` — todas atrás de `requireSubscriber()` (`PERSONAL` ou `INDIVIDUAL`, nunca `ALUNO`). UI em `/painel/assinatura`.
- **Nunca implementado aqui** (permanece na fila do EPIC-12, seção "Prova técnica" abaixo): gateway real, meios de pagamento, renovação automática, recuperação de pagamento, ledger/conciliação.

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
