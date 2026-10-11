// @vitest-environment node
//
// Indicação de personal para personal (EPIC-47) contra PostgreSQL real e
// um Asaas simulado.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { applyPersonalReferral, getOrCreateReferralCode, getReferralSummary, referralCodeFromCookie, rewardReferrer } from "./referrals";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DAY = 86_400_000;

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.personalReferral.deleteMany({ where: { referrer: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function personal(label: string, opts: { createdDaysAgo?: number; trialEndsAt?: Date | null; externalSubscriptionId?: string } = {}) {
  const owner = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: `Personal ${label}`, role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}`, createdAt: new Date(Date.now() - (opts.createdDaysAgo ?? 0) * DAY) } });
  const plan = await prisma.plan.create({ data: { slug: `plano-${label}-${run}`, audience: "PERSONAL", name: "Pro", priceCents: 4990, billingCycle: "MENSAL", trialDays: 14 } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId: plan.id, provider: "ASAAS", trialEndsAt: opts.trialEndsAt === undefined ? new Date(Date.now() + 14 * DAY) : opts.trialEndsAt, externalSubscriptionId: opts.externalSubscriptionId } });
  return { owner, tenant };
}

describe("indicação de personal (EPIC-47)", () => {
  it("cookie do link", () => {
    expect(referralCodeFromCookie("a=1; fitos_indicacao=abc23de; b=2")).toBe("abc23de");
    expect(referralCodeFromCookie("fitos_indicacao=../x")).toBeNull();
    expect(referralCodeFromCookie(null)).toBeNull();
  });

  it("indicado ganha 30 dias de teste; quem indicou ganha a próxima cobrança adiada", async () => {
    const referrer = await personal("indica", { trialEndsAt: null, externalSubscriptionId: "sub_123" });
    const referred = await personal("novo");
    const code = await getOrCreateReferralCode(referrer.tenant.id, prisma);
    expect(await getOrCreateReferralCode(referrer.tenant.id, prisma)).toBe(code);
    const before = (await prisma.saasSubscription.findUniqueOrThrow({ where: { tenantId: referred.tenant.id } })).trialEndsAt!;

    expect(await applyPersonalReferral({ referredTenantId: referred.tenant.id, code }, prisma)).toBe(true);
    expect(await applyPersonalReferral({ referredTenantId: referred.tenant.id, code }, prisma)).toBe(false);
    const after = (await prisma.saasSubscription.findUniqueOrThrow({ where: { tenantId: referred.tenant.id } })).trialEndsAt!;
    expect(after.getTime() - before.getTime()).toBe(30 * DAY);
    expect(await getReferralSummary(referrer.tenant.id, prisma)).toMatchObject({ code, invited: 1, confirmed: 0 });

    const calls: { method: string; url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ id: "sub_123", nextDueDate: "2026-11-10" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    expect(await rewardReferrer({ referredTenantId: referred.tenant.id }, { client: prisma, fetchImpl, apiKey: "chave", config: null })).toBe("recompensado");
    expect(calls.at(-1)).toMatchObject({ method: "PUT", body: { nextDueDate: "2026-12-10", updatePendingPayments: true } });
    expect(calls.at(-1)!.url).toContain("/subscriptions/sub_123");
    expect(await rewardReferrer({ referredTenantId: referred.tenant.id }, { client: prisma, fetchImpl, apiKey: "chave", config: null })).toBe("sem_indicacao");
    expect(calls).toHaveLength(2);
    expect((await getReferralSummary(referrer.tenant.id, prisma)).confirmed).toBe(1);
  });

  it("quem indicou e ainda está no teste ganha mais 30 dias de teste", async () => {
    const trialEnd = new Date(Date.now() + 5 * DAY);
    const referrer = await personal("teste", { trialEndsAt: trialEnd });
    const referred = await personal("novo2");
    await applyPersonalReferral({ referredTenantId: referred.tenant.id, code: await getOrCreateReferralCode(referrer.tenant.id, prisma) }, prisma);
    await rewardReferrer({ referredTenantId: referred.tenant.id }, { client: prisma, config: null });
    expect((await prisma.saasSubscription.findUniqueOrThrow({ where: { tenantId: referrer.tenant.id } })).trialEndsAt!.getTime()).toBe(trialEnd.getTime() + 30 * DAY);
  });

  it("não vale: autoindicação, código inexistente e conta antiga", async () => {
    const referrer = await personal("dono3");
    const old = await personal("antigo", { createdDaysAgo: 30 });
    const code = await getOrCreateReferralCode(referrer.tenant.id, prisma);
    expect(await applyPersonalReferral({ referredTenantId: referrer.tenant.id, code }, prisma)).toBe(false);
    expect(await applyPersonalReferral({ referredTenantId: old.tenant.id, code }, prisma)).toBe(false);
    expect(await applyPersonalReferral({ referredTenantId: old.tenant.id, code: "naoexiste9" }, prisma)).toBe(false);
  });
});
