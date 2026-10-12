// @vitest-environment node
//
// Cupons (feature 5, fatia 2) contra PostgreSQL real: consulta, resgate
// atômico e idempotente, última vaga concorrente, orçamento, acumulação,
// público e prévia desatualizada.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createCoupon, setCouponStatus, updateCoupon } from "./coupons";
import { listMyCoupons, quoteCoupon, redeemCoupon } from "./couponRedemptions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tag = run.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
const now = new Date("2026-10-11T15:00:00Z");
const admin = "admin-id";

afterAll(async () => {
  await prisma.couponRedemption.deleteMany({ where: { code: { contains: tag } } });
  await prisma.coupon.deleteMany({ where: { code: { contains: tag } } });
  await prisma.saasPayment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function plan(priceCents = 4990) {
  return prisma.plan.create({ data: { slug: `p-${++counter}-${run}`, audience: "PERSONAL", name: `Plano ${counter}`, priceCents, billingCycle: "MENSAL" } });
}
async function account(planId: string, options: { status?: "ATIVA" | "CANCELADA" | "INADIMPLENTE"; paid?: boolean } = {}) {
  const label = `${++counter}`;
  const user = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type: "PERSONAL" } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId, provider: "sem_integracao", status: options.status ?? "ATIVA" } });
  if (options.paid) await prisma.saasPayment.create({ data: { tenantId: tenant.id, externalPaymentId: `pay-${label}-${run}`, status: "PAGO", valueCents: 4990, dueDate: new Date("2026-08-01T15:00:00Z"), paidAt: new Date("2026-08-01T15:00:00Z"), lastEvent: "PAYMENT_RECEIVED" } });
  return { tenantId: tenant.id, userId: user.id };
}
async function campaign(planIds: string[], overrides: Record<string, unknown> = {}) {
  const code = `C${tag}${++counter}`;
  const { id } = await createCoupon(admin, { code, name: "Teste", kind: "PERCENT", amount: 2000, products: ["PERSONAL"], segments: ["NOVOS"], planIds, cycles: ["MENSAL"], startsAt: null, endsAt: null, durationCycles: 3, maxRedemptions: null, perAccountLimit: null, budgetCents: null, stackable: false, note: null, ...overrides }, prisma);
  await setCouponStatus(admin, id, "ATIVAR", prisma, now);
  return { id, code };
}
const key = () => `op-${run}-${++counter}`;
async function redeem(who: { tenantId: string; userId: string }, code: string) {
  const quote = await quoteCoupon(who, code, prisma, now);
  return redeemCoupon({ ...who, actorUserId: who.userId, code, operationKey: key(), revision: quote.revision }, prisma, now);
}

describe("cupons: resgate", () => {
  it("consulta mostra preço e condições; resgate congela e é idempotente", async () => {
    const p = await plan();
    const who = await account(p.id);
    const { code, id } = await campaign([p.id]);
    const quote = await quoteCoupon(who, code.toLowerCase(), prisma, now);
    expect(quote).toMatchObject({ code, segment: "NOVOS", baseCents: 4990, discountCents: 998, finalCents: 3992, couponDiscountCents: 998, durationCycles: 3, combinedWith: [] });

    const operationKey = key();
    const first = await redeemCoupon({ ...who, actorUserId: who.userId, code, operationKey, revision: quote.revision }, prisma, now);
    const again = await redeemCoupon({ ...who, actorUserId: who.userId, code, operationKey, revision: "qualquer" }, prisma, now);
    expect(first.replayed).toBe(false);
    expect(again).toMatchObject({ replayed: true, redemption: { id: first.redemption.id } });
    expect(first.redemption).toMatchObject({ kind: "PERCENT", amount: 2000, durationCycles: 3, cyclesUsed: 0, discountCents: 998, committedBudgetCents: 2994, state: "COMMITTED" });

    // Editar a campanha depois não muda o resgate; usar de novo é recusado.
    await updateCoupon(admin, id, { code, name: "Teste", kind: "PERCENT", amount: 5000, products: ["PERSONAL"], segments: ["NOVOS"], planIds: [p.id], cycles: ["MENSAL"], startsAt: null, endsAt: null, durationCycles: 1, maxRedemptions: null, perAccountLimit: null, budgetCents: null, stackable: false, note: null }, prisma);
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { id: first.redemption.id } })).toMatchObject({ amount: 2000, durationCycles: 3 });
    await expect(quoteCoupon(who, code, prisma, now)).rejects.toMatchObject({ kind: "ALREADY_USED" });
    expect(await listMyCoupons(who.tenantId, prisma)).toEqual([expect.objectContaining({ code, state: "EM_VIGOR", cyclesUsed: 0, durationCycles: 3 })]);
  });

  it("código inválido, rascunho, pausado, plano fora, público errado e inadimplente", async () => {
    const p = await plan();
    const other = await plan();
    const who = await account(p.id);
    await expect(quoteCoupon(who, "x", prisma, now)).rejects.toMatchObject({ kind: "INVALID_CODE" });
    await expect(quoteCoupon(who, `NAO${tag}`, prisma, now)).rejects.toMatchObject({ kind: "INVALID_CODE" });
    const draft = await createCoupon(admin, { code: `D${tag}${++counter}`, name: "R", kind: "PERCENT", amount: 1000, products: ["PERSONAL"], segments: ["NOVOS"], planIds: [p.id], cycles: ["MENSAL"], startsAt: null, endsAt: null, durationCycles: 1, maxRedemptions: null, perAccountLimit: null, budgetCents: null, stackable: false, note: null }, prisma);
    const draftCode = (await prisma.coupon.findUniqueOrThrow({ where: { id: draft.id } })).code;
    await expect(quoteCoupon(who, draftCode, prisma, now)).rejects.toMatchObject({ kind: "INVALID_CODE" });

    const paused = await campaign([p.id]);
    await setCouponStatus(admin, paused.id, "PAUSAR", prisma, now);
    await expect(quoteCoupon(who, paused.code, prisma, now)).rejects.toMatchObject({ kind: "EXPIRED" });
    const wrongPlan = await campaign([other.id]);
    await expect(quoteCoupon(who, wrongPlan.code, prisma, now)).rejects.toMatchObject({ kind: "INELIGIBLE", message: "Este cupom não vale para o seu plano." });
    const inactiveOnly = await campaign([p.id], { segments: ["INATIVOS"] });
    await expect(quoteCoupon(who, inactiveOnly.code, prisma, now)).rejects.toMatchObject({ kind: "INELIGIBLE" });
    const late = await account(p.id, { status: "INADIMPLENTE", paid: true });
    await expect(quoteCoupon(late, (await campaign([p.id])).code, prisma, now)).rejects.toMatchObject({ kind: "INELIGIBLE" });
    expect((await quoteCoupon(await account(p.id, { status: "CANCELADA", paid: true }), inactiveOnly.code, prisma, now)).segment).toBe("INATIVOS");
  });

  it("última vaga em paralelo: só uma conta leva", async () => {
    const p = await plan();
    const { code } = await campaign([p.id], { maxRedemptions: 1 });
    const a = await account(p.id);
    const b = await account(p.id);
    const [qa, qb] = await Promise.all([quoteCoupon(a, code, prisma, now), quoteCoupon(b, code, prisma, now)]);
    const results = await Promise.allSettled([
      redeemCoupon({ ...a, actorUserId: a.userId, code, operationKey: key(), revision: qa.revision }, prisma, now),
      redeemCoupon({ ...b, actorUserId: b.userId, code, operationKey: key(), revision: qb.revision }, prisma, now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { kind: "CAP_REACHED" } });
  });

  it("orçamento: compromete ciclos × desconto e recusa quando não cabe", async () => {
    const p = await plan();
    // 20% de 49,90 = 9,98 × 3 = 29,94 por conta; teto de 50 cabe uma só.
    const { code } = await campaign([p.id], { budgetCents: 5000 });
    await redeem(await account(p.id), code);
    await expect(quoteCoupon(await account(p.id), code, prisma, now)).rejects.toMatchObject({ kind: "CAP_REACHED" });
  });

  it("acumulação: dois acumuláveis (fixo antes do percentual); não acumulável fica sozinho; nunca zera", async () => {
    const p = await plan(10_000);
    const who = await account(p.id);
    const fixed = await campaign([p.id], { kind: "FIXED_AMOUNT", amount: 2000, stackable: true });
    const percent = await campaign([p.id], { amount: 1000, stackable: true });
    const solo = await campaign([p.id], { amount: 1000 });
    await redeem(who, percent.code);
    const quote = await quoteCoupon(who, fixed.code, prisma, now);
    expect(quote).toMatchObject({ discountCents: 2800, finalCents: 7200, combinedWith: [percent.code] });
    await redeem(who, fixed.code);
    await expect(quoteCoupon(who, solo.code, prisma, now)).rejects.toMatchObject({ kind: "CONFLICT" });

    const cheap = await plan(1500);
    const other = await account(cheap.id);
    const big1 = await campaign([cheap.id], { kind: "FIXED_AMOUNT", amount: 1000, stackable: true });
    const big2 = await campaign([cheap.id], { kind: "FIXED_AMOUNT", amount: 1000, stackable: true });
    await redeem(other, big1.code);
    await expect(quoteCoupon(other, big2.code, prisma, now)).rejects.toMatchObject({ kind: "CONFLICT", message: expect.stringMatching(/zerada/) });
  });

  it("prévia desatualizada é recusada", async () => {
    const p = await plan();
    const who = await account(p.id);
    const { code } = await campaign([p.id]);
    await expect(redeemCoupon({ ...who, actorUserId: who.userId, code, operationKey: key(), revision: "velha" }, prisma, now)).rejects.toMatchObject({ kind: "QUOTE_STALE" });
    expect(await prisma.couponRedemption.count({ where: { tenantId: who.tenantId } })).toBe(0);
  });
});
