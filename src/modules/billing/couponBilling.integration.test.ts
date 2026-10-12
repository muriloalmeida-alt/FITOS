// @vitest-environment node
//
// Cupons (feature 5, fatia 3) contra PostgreSQL real e um Asaas simulado:
// desconto na cobrança criada (nunca na assinatura), ciclo contado só no
// pagamento e uma vez, fim dos ciclos, cobrança já paga sem desconto,
// timeout reconciliado sem PUT repetido, troca para plano inelegível e
// cancelamento.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createCoupon, setCouponStatus } from "./coupons";
import { quoteCoupon, redeemCoupon } from "./couponRedemptions";
import { applyCouponsToPayment, countCouponCycle, handleCouponPaymentEvent, reconcilePendingCouponApplications, releaseCouponPayment } from "./couponBilling";
import { cancelSubscription } from "./subscriptions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tag = run.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
const now = new Date("2026-10-11T15:00:00Z");

afterAll(async () => {
  await prisma.couponRedemption.deleteMany({ where: { code: { contains: tag } } });
  await prisma.coupon.deleteMany({ where: { code: { contains: tag } } });
  await prisma.saasPayment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

/// Asaas simulado: cobranças em memória; registra cada chamada.
function fakeAsaas() {
  const payments = new Map<string, { id: string; status: string; value: number; dueDate: string; deleted?: boolean }>();
  const calls: string[] = [];
  let failNextPut: "timeout-after-apply" | "network" | null = null;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/v3/, "");
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    const id = decodeURIComponent(path.split("/")[2] ?? "");
    const payment = payments.get(id);
    if (!payment) return new Response(JSON.stringify({ errors: [{ code: "not_found", description: "x" }] }), { status: 404 });
    if (method === "PUT") {
      if (failNextPut === "network") {
        failNextPut = null;
        throw new TypeError("fetch failed");
      }
      payment.value = JSON.parse(String(init?.body)).value;
      if (failNextPut === "timeout-after-apply") {
        failNextPut = null;
        throw new TypeError("fetch failed");
      }
    }
    return new Response(JSON.stringify(payment), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return {
    payments,
    calls,
    failNext: (mode: "timeout-after-apply" | "network") => (failNextPut = mode),
    deps: { apiKey: "k", fetchImpl, enabled: true },
  };
}

let counter = 0;
async function setup(options: { durationCycles?: number; amount?: number; stackable?: boolean; kind?: string } = {}) {
  const label = `${++counter}`;
  const plan = await prisma.plan.create({ data: { slug: `p-${label}-${run}`, audience: "PERSONAL", name: `Plano ${label}`, priceCents: 4990, billingCycle: "MENSAL" } });
  const user = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type: "PERSONAL" } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId: plan.id, provider: "asaas", status: "ATIVA", externalSubscriptionId: `sub-${label}-${run}` } });
  const code = `B${tag}${label}`;
  const { id } = await createCoupon("admin", { code, name: "T", kind: options.kind ?? "PERCENT", amount: options.amount ?? 2000, products: ["PERSONAL"], segments: ["NOVOS"], planIds: [plan.id], cycles: ["MENSAL"], startsAt: null, endsAt: null, durationCycles: options.durationCycles ?? 2, maxRedemptions: null, perAccountLimit: null, budgetCents: null, stackable: options.stackable ?? false, note: null }, prisma);
  await setCouponStatus("admin", id, "ATIVAR", prisma, now);
  const scope = { tenantId: tenant.id };
  const quote = await quoteCoupon(scope, code, prisma, now);
  const { redemption } = await redeemCoupon({ tenantId: tenant.id, actorUserId: user.id, code, operationKey: `op-${label}-${run}`, revision: quote.revision }, prisma, now);
  return { tenantId: tenant.id, userId: user.id, plan, redemption };
}

async function charge(asaas: ReturnType<typeof fakeAsaas>, tenantId: string, id: string, status = "PENDING") {
  asaas.payments.set(id, { id, status, value: 49.9, dueDate: "2026-11-01" });
  await prisma.saasPayment.create({ data: { tenantId, externalPaymentId: id, status: "PENDENTE", valueCents: 4990, lastEvent: "PAYMENT_CREATED" } });
}

describe("cupons: desconto na cobrança", () => {
  it("cobrança criada recebe o desconto; o ciclo conta só no pagamento e uma vez; acabados os ciclos, vem cheia", async () => {
    const asaas = fakeAsaas();
    const ctx = await setup({ durationCycles: 2 });
    const id1 = `pay-a-${run}`;
    await charge(asaas, ctx.tenantId, id1);
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: id1 }, asaas.deps, prisma, now)).toBe("APLICADO");
    expect(asaas.payments.get(id1)!.value).toBe(39.92);
    expect(asaas.calls.filter((call) => call.startsWith("PUT"))).toEqual([`PUT /payments/${id1}`]);
    // Nunca muda a assinatura.
    expect(asaas.calls.some((call) => call.includes("/subscriptions"))).toBe(false);
    // Reentrega do mesmo evento não aplica de novo.
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: id1 }, asaas.deps, prisma, now)).toBe("APLICADO");
    expect(await prisma.couponCycleApplication.count({ where: { externalPaymentId: id1 } })).toBe(1);

    expect(await countCouponCycle(id1, prisma, now)).toBe(1);
    expect(await countCouponCycle(id1, prisma, now)).toBe(0);
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { id: ctx.redemption.id } })).toMatchObject({ cyclesUsed: 1, appliedCents: 998, state: "COMMITTED" });

    const id2 = `pay-b-${run}`;
    await charge(asaas, ctx.tenantId, id2);
    await handleCouponPaymentEvent("PAYMENT_CREATED", id2, asaas.deps, prisma, now);
    await handleCouponPaymentEvent("PAYMENT_RECEIVED", id2, asaas.deps, prisma, now);
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { id: ctx.redemption.id } })).toMatchObject({ cyclesUsed: 2, appliedCents: 1996, state: "ENDED", endReason: "CICLOS_CONCLUIDOS" });

    const id3 = `pay-c-${run}`;
    await charge(asaas, ctx.tenantId, id3);
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: id3 }, asaas.deps, prisma, now)).toBe("SEM_CUPOM");
    expect(asaas.payments.get(id3)!.value).toBe(49.9);
  });

  it("cobrança já paga (cartão capturado) fica sem desconto e não usa ciclo; removida libera o ciclo", async () => {
    const asaas = fakeAsaas();
    const ctx = await setup({ durationCycles: 1 });
    const paid = `pay-d-${run}`;
    await charge(asaas, ctx.tenantId, paid, "CONFIRMED");
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: paid }, asaas.deps, prisma, now)).toBe("IGNORADO");
    expect(asaas.calls.some((call) => call.startsWith("PUT"))).toBe(false);

    const removed = `pay-e-${run}`;
    await charge(asaas, ctx.tenantId, removed);
    await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: removed }, asaas.deps, prisma, now);
    await releaseCouponPayment(removed, prisma);
    const next = `pay-f-${run}`;
    await charge(asaas, ctx.tenantId, next);
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: next }, asaas.deps, prisma, now)).toBe("APLICADO");
  });

  it("timeout depois de aplicar: fica PENDING e a reconciliação lê o Asaas e confirma sem novo PUT; rede fora 3 vezes vira FAILED", async () => {
    const asaas = fakeAsaas();
    const ctx = await setup();
    const id = `pay-g-${run}`;
    await charge(asaas, ctx.tenantId, id);
    asaas.failNext("timeout-after-apply");
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: id }, asaas.deps, prisma, now)).toBe("PENDENTE");
    const puts = asaas.calls.filter((call) => call.startsWith("PUT")).length;
    await reconcilePendingCouponApplications(asaas.deps, prisma, new Date(Date.now() + 120_000));
    expect(asaas.calls.filter((call) => call.startsWith("PUT")).length).toBe(puts);
    expect(await prisma.couponCycleApplication.findFirstOrThrow({ where: { externalPaymentId: id } })).toMatchObject({ status: "APPLIED" });

    const other = await setup();
    const id2 = `pay-h-${run}`;
    await charge(asaas, other.tenantId, id2);
    for (let attempt = 0; attempt < 3; attempt++) {
      asaas.failNext("network");
      await applyCouponsToPayment({ tenantId: other.tenantId, externalPaymentId: id2 }, asaas.deps, prisma, now);
    }
    expect(await prisma.couponCycleApplication.findFirstOrThrow({ where: { externalPaymentId: id2 } })).toMatchObject({ status: "FAILED", attempts: 3 });
    expect(asaas.payments.get(id2)!.value).toBe(49.9);
  });

  it("plano trocado para inelegível encerra o cupom; cancelar encerra; flag desligada não escreve", async () => {
    const asaas = fakeAsaas();
    const ctx = await setup();
    const other = await prisma.plan.create({ data: { slug: `p-outro-${run}`, audience: "PERSONAL", name: "Outro", priceCents: 9990, billingCycle: "MENSAL" } });
    await prisma.saasSubscription.update({ where: { tenantId: ctx.tenantId }, data: { planId: other.id } });
    const id = `pay-i-${run}`;
    await charge(asaas, ctx.tenantId, id);
    expect(await applyCouponsToPayment({ tenantId: ctx.tenantId, externalPaymentId: id }, asaas.deps, prisma, now)).toBe("SEM_CUPOM");
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { id: ctx.redemption.id } })).toMatchObject({ state: "ENDED", endReason: "PLANO_INELEGIVEL" });

    const second = await setup();
    await cancelSubscription({ tenantId: second.tenantId, actorUserId: second.userId, reason: "teste" }, prisma);
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { id: second.redemption.id } })).toMatchObject({ state: "ENDED", endReason: "ASSINATURA_CANCELADA" });

    const third = await setup();
    const id3 = `pay-j-${run}`;
    await charge(asaas, third.tenantId, id3);
    expect(await applyCouponsToPayment({ tenantId: third.tenantId, externalPaymentId: id3 }, { ...asaas.deps, enabled: false }, prisma, now)).toBe("DESLIGADO");
    expect(asaas.payments.get(id3)!.value).toBe(49.9);
  });
});
