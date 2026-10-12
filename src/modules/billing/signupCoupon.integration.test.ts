// @vitest-environment node
//
// Cupom no cadastro contra PostgreSQL real: conferência antes da conta
// existir e resgate na conta nova.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createCoupon, setCouponStatus } from "./coupons";
import { checkSignupCoupon, redeemSignupCoupon } from "./signupCoupon";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const suffix = run.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
let planId = "";
const couponIds: string[] = [];

async function coupon(code: string, overrides: Record<string, unknown> = {}) {
  const { id } = await createCoupon("admin-cadastro", { code, name: `Cadastro ${run}`, kind: "PERCENT", amount: 2000, products: ["INDIVIDUAL"], segments: ["NOVOS"], planIds: [planId], cycles: ["MENSAL"], startsAt: null, endsAt: null, durationCycles: 2, maxRedemptions: null, perAccountLimit: 1, budgetCents: null, stackable: false, note: null, ...overrides }, prisma);
  couponIds.push(id);
  await setCouponStatus("admin-cadastro", id, "ATIVAR", prisma);
  return id;
}

beforeAll(async () => {
  planId = (await prisma.plan.create({ data: { slug: `livre-cad-${run}`, audience: "INDIVIDUAL", name: "Livre teste", priceCents: 1990, billingCycle: "MENSAL" } })).id;
});

afterAll(async () => {
  await prisma.couponRedemption.deleteMany({ where: { couponId: { in: couponIds } } });
  await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

describe("cupom no cadastro", () => {
  it("confere antes da conta e fica registrado na conta nova", async () => {
    await coupon(`BEMVINDO${suffix}`);
    const check = await checkSignupCoupon(` bemvindo${suffix.toLowerCase()} `, "INDIVIDUAL", prisma);
    expect(check).toMatchObject({ ok: true, code: `BEMVINDO${suffix}` });
    expect(await checkSignupCoupon(`BEMVINDO${suffix}`, "PERSONAL", prisma)).toEqual({ ok: false, message: "Este cupom não vale para contas de personal." });
    expect(await checkSignupCoupon("NAOEXISTE123", "INDIVIDUAL", prisma)).toMatchObject({ ok: false });

    const user = await prisma.user.create({ data: { email: `novo-${run}@example.test`, name: "Nova", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${run}`, type: "INDIVIDUAL" } });
    await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId, provider: "sem_integracao", status: "ATIVA", trialEndsAt: new Date(Date.now() + 30 * 86_400_000) } });
    expect(await redeemSignupCoupon({ tenantId: tenant.id, userId: user.id, code: `BEMVINDO${suffix}` }, prisma)).toEqual({ applied: true, code: `BEMVINDO${suffix}` });
    // Repetir o cadastro não resgata duas vezes.
    expect(await redeemSignupCoupon({ tenantId: tenant.id, userId: user.id, code: `BEMVINDO${suffix}` }, prisma)).toMatchObject({ applied: true });
    const redemptions = await prisma.couponRedemption.findMany({ where: { tenantId: tenant.id } });
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0]).toMatchObject({ amount: 2000, durationCycles: 2, state: "COMMITTED" });
  });

  it("cupom de contas escolhidas (convites) não vale digitado no cadastro", async () => {
    const owner = await prisma.user.create({ data: { email: `sel-${run}@example.test`, name: "Sel", role: "INDIVIDUAL" } });
    const selected = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Sel ${run}`, type: "INDIVIDUAL" } });
    await coupon(`AMIGOT${suffix}`, { segments: ["SELECIONADOS"], selectedTenantIds: [selected.id], durationCycles: 1, maxRedemptions: 1 });
    expect(await checkSignupCoupon(`AMIGOT${suffix}`, "INDIVIDUAL", prisma)).toMatchObject({ ok: false });
  });
});
