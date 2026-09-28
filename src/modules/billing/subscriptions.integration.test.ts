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

async function createPlan(
  label: string,
  overrides: Partial<{ audience: "PERSONAL" | "INDIVIDUAL"; active: boolean; studentLimit: number | null; trialDays: number | null }> = {}
) {
  return prisma.plan.create({
    data: {
      slug: `${run}-${label}`,
      audience: overrides.audience ?? "PERSONAL",
      name: `Plano ${label}`,
      billingCycle: "MENSAL",
      active: overrides.active ?? true,
      studentLimit: overrides.studentLimit,
      trialDays: overrides.trialDays,
    },
  });
}

async function createActiveStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}`, status: "ATIVO" },
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

  it("FIT-127: concede trial na primeira contratação de um plano com trialDays", async () => {
    const { tenant, owner } = await createTenant("trial-primeira");
    const plano = await createPlan("trial-primeira", { trialDays: 30 });

    const antes = new Date();
    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.trialUsedAt).not.toBeNull();
    expect(assinatura.trialEndsAt).not.toBeNull();
    const diasDeTrial = Math.round((assinatura.trialEndsAt!.getTime() - antes.getTime()) / (24 * 60 * 60 * 1000));
    expect(diasDeTrial).toBe(30);
  });

  it("FIT-127: plano sem trialDays nunca concede trial", async () => {
    const { tenant, owner } = await createTenant("sem-trial");
    const plano = await createPlan("sem-trial", { trialDays: null });

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.trialUsedAt).toBeNull();
    expect(assinatura.trialEndsAt).toBeNull();
  });

  it("FIT-127: trocar de plano nunca concede um novo trial nem reinicia a contagem (trialUsedAt já setado)", async () => {
    const { tenant, owner } = await createTenant("trial-troca");
    const planoA = await createPlan("trial-troca-a", { trialDays: 30 });
    const planoB = await createPlan("trial-troca-b", { trialDays: 30 });

    const primeira = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoA.id, actorUserId: owner.id },
      prisma
    );
    const segunda = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoB.id, actorUserId: owner.id },
      prisma
    );

    expect(segunda.trialUsedAt?.getTime()).toBe(primeira.trialUsedAt?.getTime());
    expect(segunda.trialEndsAt?.getTime()).toBe(primeira.trialEndsAt?.getTime());
  });

  it("FIT-127: rejeita troca para plano com studentLimit menor que a quantidade de alunos ativos (LIMITE_ABAIXO_DO_USO_ATUAL)", async () => {
    const { tenant, owner } = await createTenant("downgrade");
    const planoAmplo = await createPlan("downgrade-amplo", { studentLimit: 50 });
    const planoRestrito = await createPlan("downgrade-restrito", { studentLimit: 1 });
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoAmplo.id, actorUserId: owner.id }, prisma);
    await createActiveStudent(tenant.id, "downgrade-1");
    await createActiveStudent(tenant.id, "downgrade-2");

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoRestrito.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "LIMITE_ABAIXO_DO_USO_ATUAL" });
  });

  it("FIT-127: permite troca quando a quantidade de alunos ativos está dentro do novo limite", async () => {
    const { tenant, owner } = await createTenant("downgrade-ok");
    const planoAmplo = await createPlan("downgrade-ok-amplo", { studentLimit: 50 });
    const planoMenor = await createPlan("downgrade-ok-menor", { studentLimit: 5 });
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoAmplo.id, actorUserId: owner.id }, prisma);
    await createActiveStudent(tenant.id, "downgrade-ok-1");

    const trocada = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoMenor.id, actorUserId: owner.id },
      prisma
    );

    expect(trocada.planId).toBe(planoMenor.id);
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
