// @vitest-environment node
//
// Testes de integração da reconciliação de eventos de pagamento do Asaas
// (FIT-128, ADR-010 item (c)) contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { reconcileAsaasPaymentEvent } from "./asaasWebhook";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenantWithSubscription(
  label: string,
  overrides: Partial<{ status: "ATIVA" | "INADIMPLENTE" | "CANCELADA"; externalSubscriptionId: string | null; externalCustomerId: string | null }> = {}
) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "PERSONAL" } });
  const plan = await prisma.plan.create({
    data: { slug: `${run}-${label}`, audience: "PERSONAL", name: `Plano ${label}`, billingCycle: "MENSAL", active: true, priceCents: 4990 },
  });
  /// `"key" in overrides` (não `??`) porque um teste pode passar
  /// explicitamente `null` para simular "nunca ligado a este identificador
  /// no Asaas" — `??` trataria esse `null` explícito como "não informado"
  /// e aplicaria o valor padrão por engano.
  const externalCustomerId = "externalCustomerId" in overrides ? overrides.externalCustomerId : `cus_${label}`;
  const externalSubscriptionId = "externalSubscriptionId" in overrides ? overrides.externalSubscriptionId : `sub_${label}`;
  const subscription = await prisma.saasSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: overrides.status ?? "ATIVA",
      provider: "asaas",
      externalCustomerId,
      externalSubscriptionId,
    },
  });
  return { tenant, subscription };
}

describe("reconcileAsaasPaymentEvent (FIT-128, ADR-010 item c)", () => {
  it("PAYMENT_RECEIVED aplica ATIVA quando a assinatura estava INADIMPLENTE", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("recebido", { status: "INADIMPLENTE" });

    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: subscription.externalSubscriptionId, customer: null } },
      prisma
    );

    expect(result).toEqual({ outcome: "ATIVA_APLICADA", tenantId: tenant.id });
    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.status).toBe("ATIVA");
  });

  it("PAYMENT_CONFIRMED e PAYMENT_RECEIVED_IN_CASH também aplicam ATIVA", async () => {
    for (const event of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]) {
      const { tenant, subscription } = await createTenantWithSubscription(`${event}-ok`, { status: "INADIMPLENTE" });
      const result = await reconcileAsaasPaymentEvent(
        { event, payment: { id: `pay-${event}`, subscription: subscription.externalSubscriptionId, customer: null } },
        prisma
      );
      expect(result.outcome).toBe("ATIVA_APLICADA");
      const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
      expect(updated?.status).toBe("ATIVA");
    }
  });

  it("PAYMENT_OVERDUE aplica INADIMPLENTE quando a assinatura estava ATIVA", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("atrasado", { status: "ATIVA" });

    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_OVERDUE", payment: { id: "pay_2", subscription: subscription.externalSubscriptionId, customer: null } },
      prisma
    );

    expect(result).toEqual({ outcome: "INADIMPLENTE_APLICADA", tenantId: tenant.id });
    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.status).toBe("INADIMPLENTE");
  });

  it("é idempotente: reentregar o mesmo evento não muda nada na segunda vez", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("idempotente", { status: "ATIVA" });
    const event = { event: "PAYMENT_OVERDUE", payment: { id: "pay_3", subscription: subscription.externalSubscriptionId, customer: null } };

    const first = await reconcileAsaasPaymentEvent(event, prisma);
    const second = await reconcileAsaasPaymentEvent(event, prisma);

    expect(first.outcome).toBe("INADIMPLENTE_APLICADA");
    expect(second.outcome).toBe("IGNORADO_SEM_MUDANCA");
    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.status).toBe("INADIMPLENTE");
  });

  it("nunca reabre uma assinatura já CANCELADA localmente", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("cancelada", { status: "CANCELADA" });

    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_RECEIVED", payment: { id: "pay_4", subscription: subscription.externalSubscriptionId, customer: null } },
      prisma
    );

    expect(result).toEqual({ outcome: "IGNORADO_ASSINATURA_CANCELADA_LOCALMENTE", tenantId: tenant.id });
    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.status).toBe("CANCELADA");
  });

  it("cai para externalCustomerId quando o pagamento não tem subscription associada", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("sem-subscription", { status: "ATIVA", externalSubscriptionId: null });

    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_OVERDUE", payment: { id: "pay_5", subscription: null, customer: subscription.externalCustomerId } },
      prisma
    );

    expect(result).toEqual({ outcome: "INADIMPLENTE_APLICADA", tenantId: tenant.id });
  });

  it("ignora sem erro quando nenhuma assinatura local corresponde ao evento", async () => {
    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_RECEIVED", payment: { id: "pay_6", subscription: "sub_desconhecida", customer: null } },
      prisma
    );

    expect(result).toEqual({ outcome: "IGNORADO_SEM_ASSINATURA_LOCAL", tenantId: null });
  });

  it("ignora sem erro (e sem mudar nada) um evento não tratado", async () => {
    const { tenant, subscription } = await createTenantWithSubscription("nao-tratado", { status: "ATIVA" });

    const result = await reconcileAsaasPaymentEvent(
      { event: "PAYMENT_DELETED", payment: { id: "pay_7", subscription: subscription.externalSubscriptionId, customer: null } },
      prisma
    );

    expect(result).toEqual({ outcome: "IGNORADO_EVENTO_NAO_TRATADO", tenantId: null });
    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.status).toBe("ATIVA");
  });
});
