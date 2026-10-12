// @vitest-environment node
//
// Indicação do FitOS Livre contra PostgreSQL real: o amigo ganha 50% no
// primeiro mês (cupom próprio); quem indicou ganha 10% na próxima
// cobrança quando o amigo paga, sem acumular.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { REFERRAL_ACTOR, applyLivreReferral, getOrCreateReferralCode, getReferralSummary, referrerType, rewardReferrer } from "./referrals";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let planId = "";

beforeAll(async () => {
  planId = (await prisma.plan.create({ data: { slug: `livre-ind-${run}`, audience: "INDIVIDUAL", name: "Livre teste", priceCents: 1990, billingCycle: "MENSAL" } })).id;
});

afterAll(async () => {
  const tenants = { tenant: { name: { contains: run } } };
  const coupons = await prisma.coupon.findMany({ where: { createdById: REFERRAL_ACTOR, versions: { some: { members: { some: tenants } } } }, select: { id: true } });
  await prisma.couponRedemption.deleteMany({ where: tenants });
  await prisma.coupon.deleteMany({ where: { id: { in: coupons.map((row) => row.id) } } });
  await prisma.personalReferral.deleteMany({ where: { referrer: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: tenants });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function account(label: string, type: "INDIVIDUAL" | "PERSONAL" = "INDIVIDUAL") {
  const user = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: `Pessoa ${label}`, role: type } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId, provider: "sem_integracao", status: "ATIVA", trialEndsAt: new Date(Date.now() + 30 * 86_400_000) } });
  return { userId: user.id, tenantId: tenant.id };
}

const redemptions = (tenantId: string) => prisma.couponRedemption.findMany({ where: { tenantId, state: "COMMITTED" }, orderBy: { committedAt: "asc" } });
const reward = (referredTenantId: string) => rewardReferrer({ referredTenantId }, { client: prisma, config: null });

describe("indicação do FitOS Livre", () => {
  it("amigo ganha 50%; quem indicou ganha 10% uma vez, sem acumular", async () => {
    const referrer = await account("indica");
    const code = await getOrCreateReferralCode(referrer.tenantId, prisma);
    expect(await referrerType(code, prisma)).toBe("INDIVIDUAL");

    const friend = await account("amigo1");
    expect(await applyLivreReferral({ referredTenantId: friend.tenantId, userId: friend.userId, code }, prisma)).toEqual({ applied: true, couponApplied: true });
    expect(await applyLivreReferral({ referredTenantId: friend.tenantId, userId: friend.userId, code }, prisma)).toEqual({ applied: false, couponApplied: false });
    const [friendCoupon] = await redemptions(friend.tenantId);
    expect(friendCoupon).toMatchObject({ kind: "PERCENT", amount: 5000, durationCycles: 1 });
    expect(friendCoupon!.code).toMatch(/^AMIGO-/);

    // Segundo amigo antes de qualquer pagamento.
    const friend2 = await account("amigo2");
    await applyLivreReferral({ referredTenantId: friend2.tenantId, userId: friend2.userId, code }, prisma);

    expect(await reward(friend.tenantId)).toBe("recompensado");
    expect(await reward(friend.tenantId)).toBe("sem_indicacao");
    expect(await reward(friend2.tenantId)).toBe("recompensado");
    const rewards = await redemptions(referrer.tenantId);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ amount: 1000, durationCycles: 1 });
    expect(rewards[0]!.code).toMatch(/^INDICA-/);
    expect(await getReferralSummary(referrer.tenantId, prisma)).toMatchObject({ invited: 2, confirmed: 2, discountPending: true });

    // Desconto usado: a próxima indicação confirmada vale de novo.
    await prisma.couponRedemption.update({ where: { id: rewards[0]!.id }, data: { cyclesUsed: 1, state: "ENDED" } });
    expect((await getReferralSummary(referrer.tenantId, prisma)).discountPending).toBe(false);
    const friend3 = await account("amigo3");
    await applyLivreReferral({ referredTenantId: friend3.tenantId, userId: friend3.userId, code }, prisma);
    expect(await reward(friend3.tenantId)).toBe("recompensado");
    expect(await redemptions(referrer.tenantId)).toHaveLength(1);
    expect(await prisma.couponRedemption.count({ where: { tenantId: referrer.tenantId, code: { startsWith: "INDICA-" } } })).toBe(2);
  });

  it("com outro cupom em vigor, o prêmio espera o próximo pagamento do amigo", async () => {
    const first = await account("primeiro");
    const middle = await account("meio");
    await applyLivreReferral({ referredTenantId: middle.tenantId, userId: middle.userId, code: await getOrCreateReferralCode(first.tenantId, prisma) }, prisma);
    // `meio` está com os 50% de amigo em vigor (não combinam com outro cupom).
    const last = await account("ultimo");
    await applyLivreReferral({ referredTenantId: last.tenantId, userId: last.userId, code: await getOrCreateReferralCode(middle.tenantId, prisma) }, prisma);

    expect(await reward(last.tenantId)).toBe("sem_indicacao");
    expect((await prisma.personalReferral.findUniqueOrThrow({ where: { referredTenantId: last.tenantId } })).rewardedAt).toBeNull();
    expect(await prisma.couponRedemption.count({ where: { tenantId: middle.tenantId, code: { startsWith: "INDICA-" } } })).toBe(0);

    const [friendCoupon] = await redemptions(middle.tenantId);
    await prisma.couponRedemption.update({ where: { id: friendCoupon!.id }, data: { cyclesUsed: 1, state: "ENDED" } });
    expect(await reward(last.tenantId)).toBe("recompensado");
    expect(await prisma.couponRedemption.count({ where: { tenantId: middle.tenantId, code: { startsWith: "INDICA-" } } })).toBe(1);
  });

  it("não vale entre personal e Livre, nem para si mesmo", async () => {
    const personal = await account("personal", "PERSONAL");
    const livre = await account("livre");
    expect(await referrerType(await getOrCreateReferralCode(personal.tenantId, prisma), prisma)).toBe("PERSONAL");
    expect((await applyLivreReferral({ referredTenantId: livre.tenantId, userId: livre.userId, code: await getOrCreateReferralCode(personal.tenantId, prisma) }, prisma)).applied).toBe(false);
    expect((await applyLivreReferral({ referredTenantId: livre.tenantId, userId: livre.userId, code: await getOrCreateReferralCode(livre.tenantId, prisma) }, prisma)).applied).toBe(false);
    expect((await applyLivreReferral({ referredTenantId: livre.tenantId, userId: livre.userId, code: "naoexiste9" }, prisma)).applied).toBe(false);
  });
});
