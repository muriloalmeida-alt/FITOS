// @vitest-environment node
//
// Testes de integração de contratação/troca/cancelamento de assinatura SaaS
// (FIT-122) contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  NO_PAYMENT_PROVIDER,
  cancelSubscription,
  getSubscriptionForTenant,
  subscribeTenantToPlan,
} from "./subscriptions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string, type: "PERSONAL" | "INDIVIDUAL" = "PERSONAL") {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: type },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type } });
  return { owner, tenant };
}

async function createPlan(label: string, overrides: Partial<{ audience: "PERSONAL" | "INDIVIDUAL"; active: boolean }> = {}) {
  return prisma.plan.create({
    data: {
      slug: `${run}-${label}`,
      audience: overrides.audience ?? "PERSONAL",
      name: `Plano ${label}`,
      billingCycle: "MENSAL",
      active: overrides.active ?? true,
    },
  });
}

describe("subscribeTenantToPlan (FIT-122)", () => {
  it("contrata um plano pela primeira vez e registra AuditEvent", async () => {
    const { tenant, owner } = await createTenant("contratar");
    const plano = await createPlan("contratar");

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.planId).toBe(plano.id);
    expect(assinatura.status).toBe("ATIVA");
    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);

    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "SaasSubscription", entityId: assinatura.id } });
    expect(audit?.action).toBe("ASSINATURA_CONTRATADA");
  });

  it("troca de plano reaproveitando a mesma linha (tenantId único)", async () => {
    const { tenant, owner } = await createTenant("trocar");
    const planoA = await createPlan("trocar-a");
    const planoB = await createPlan("trocar-b");

    const primeira = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoA.id, actorUserId: owner.id },
      prisma
    );
    const segunda = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoB.id, actorUserId: owner.id },
      prisma
    );

    expect(segunda.id).toBe(primeira.id);
    expect(segunda.planId).toBe(planoB.id);

    const total = await prisma.saasSubscription.count({ where: { tenantId: tenant.id } });
    expect(total).toBe(1);
  });

  it("reativa uma assinatura cancelada ao contratar de novo", async () => {
    const { tenant, owner } = await createTenant("reativar");
    const plano = await createPlan("reativar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);
    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo qualquer" }, prisma);

    const reativada = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(reativada.status).toBe("ATIVA");
    expect(reativada.canceledAt).toBeNull();
    expect(reativada.canceledReason).toBeNull();
  });

  it("rejeita plano de audiência incompatível (AUDIENCIA_INCOMPATIVEL)", async () => {
    const { tenant, owner } = await createTenant("audiencia", "PERSONAL");
    const planoIndividual = await createPlan("audiencia", { audience: "INDIVIDUAL" });

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoIndividual.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "AUDIENCIA_INCOMPATIVEL" });
  });

  it("rejeita plano inativo para nova contratação (PLANO_INATIVO)", async () => {
    const { tenant, owner } = await createTenant("inativo");
    const planoInativo = await createPlan("inativo", { active: false });

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoInativo.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "PLANO_INATIVO" });
  });

  it("rejeita plano inexistente (NAO_ENCONTRADO)", async () => {
    const { tenant, owner } = await createTenant("inexistente");

    await expect(
      subscribeTenantToPlan(
        { tenantId: tenant.id, tenantType: "PERSONAL", planId: `plano-inexistente-${run}`, actorUserId: owner.id },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("cancelSubscription (FIT-122)", () => {
  it("cancela, registra motivo e AuditEvent", async () => {
    const { tenant, owner } = await createTenant("cancelar");
    const plano = await createPlan("cancelar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    const cancelada = await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Não preciso mais" }, prisma);

    expect(cancelada.status).toBe("CANCELADA");
    expect(cancelada.canceledReason).toBe("Não preciso mais");
    expect(cancelada.canceledAt).not.toBeNull();
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "SaasSubscription", entityId: cancelada.id, action: "ASSINATURA_CANCELADA" } });
    expect(audit).not.toBeNull();
  });

  it("é idempotente: cancelar de novo não gera um segundo AuditEvent", async () => {
    const { tenant, owner } = await createTenant("cancelar-idempotente");
    const plano = await createPlan("cancelar-idempotente");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);
    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo original" }, prisma);

    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo ignorado" }, prisma);

    const eventos = await prisma.auditEvent.count({
      where: { entityType: "SaasSubscription", action: "ASSINATURA_CANCELADA", tenantId: tenant.id },
    });
    expect(eventos).toBe(1);
    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);
    expect(assinatura?.canceledReason).toBe("Motivo original");
  });

  it("rejeita motivo vazio (VALIDACAO)", async () => {
    const { tenant, owner } = await createTenant("motivo-vazio");
    const plano = await createPlan("motivo-vazio");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    await expect(cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "   " }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });

  it("rejeita tenant sem assinatura (NAO_ENCONTRADO)", async () => {
    const { tenant, owner } = await createTenant("sem-assinatura");

    await expect(
      cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Qualquer" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("getSubscriptionForTenant (FIT-122)", () => {
  it("retorna a assinatura com o plano incluído", async () => {
    const { tenant, owner } = await createTenant("consultar");
    const plano = await createPlan("consultar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);

    expect(assinatura?.plan?.id).toBe(plano.id);
  });

  it("retorna null quando o tenant nunca assinou", async () => {
    const { tenant } = await createTenant("nunca-assinou");

    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);

    expect(assinatura).toBeNull();
  });
});
