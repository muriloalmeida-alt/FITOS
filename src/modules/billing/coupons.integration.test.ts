// @vitest-environment node
//
// Cupons de desconto (feature 5, fatia 1) contra PostgreSQL real: criar em
// rascunho, código único, prévia de preço e público, ativar só sem
// problemas, versões depois de ativado, transições e auditoria.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { AdminError } from "@/modules/admin/users";
import { accountFacts, createCoupon, getCoupon, listCoupons, previewCouponInput, searchCouponAccounts, setCouponStatus, updateCoupon } from "./coupons";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tag = run.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
const now = new Date("2026-10-11T15:00:00Z");
const admin = "admin-id";

afterAll(async () => {
  await prisma.coupon.deleteMany({ where: { code: { contains: tag } } });
  await prisma.saasPayment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function plan(priceCents: number, audience: "PERSONAL" | "INDIVIDUAL" = "PERSONAL") {
  return prisma.plan.create({ data: { slug: `p-${++counter}-${run}`, audience, name: `Plano ${counter}`, priceCents, billingCycle: "MENSAL" } });
}
async function account(planId: string, status: "ATIVA" | "CANCELADA" | "INADIMPLENTE", paid: boolean) {
  const label = `${++counter}`;
  const user = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type: "PERSONAL" } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId, provider: "sem_integracao", status } });
  if (paid) await prisma.saasPayment.create({ data: { tenantId: tenant.id, externalPaymentId: `pay-${label}-${run}`, status: "PAGO", valueCents: 4990, dueDate: new Date("2026-08-01T15:00:00Z"), paidAt: new Date("2026-08-01T15:00:00Z"), lastEvent: "PAYMENT_RECEIVED" } });
  return tenant;
}

const input = (planIds: string[], overrides: Record<string, unknown> = {}) => ({
  code: `volta-${tag}-${++counter}`,
  name: "Reativação",
  kind: "PERCENT",
  amount: 2000,
  products: ["PERSONAL"],
  segments: ["INATIVOS"],
  planIds,
  cycles: ["MENSAL"],
  startsAt: null,
  endsAt: null,
  durationCycles: 3,
  maxRedemptions: 50,
  perAccountLimit: null,
  budgetCents: null,
  stackable: false,
  note: null,
  ...overrides,
});

describe("cupons: administração", () => {
  it("fatos da conta: nova, ativa paga, cancelada paga (inativa)", async () => {
    const p = await plan(4990);
    const fresh = await account(p.id, "ATIVA", false);
    const inactive = await account(p.id, "CANCELADA", true);
    expect(await accountFacts(fresh.id, prisma)).toMatchObject({ tenantType: "PERSONAL", subscriptionStatus: "ATIVA", hasPaidCharge: false });
    const facts = await accountFacts(inactive.id, prisma);
    expect(facts).toMatchObject({ subscriptionStatus: "CANCELADA", hasPaidCharge: true });
    expect(facts!.paidAccessUntil!.toISOString()).toBe("2026-08-31T15:00:00.000Z");
  });

  it("cria em rascunho com código normalizado e único; prévia mostra preços e público estimado", async () => {
    const p = await plan(4990);
    await account(p.id, "CANCELADA", true);
    await account(p.id, "CANCELADA", true);
    await account(p.id, "ATIVA", true);
    const data = input([p.id]);
    const { id } = await createCoupon(admin, data, prisma);
    const detail = await getCoupon(id, prisma);
    expect(detail).toMatchObject({ code: String(data.code).toUpperCase(), status: "DRAFT", version: 1, amount: 2000, perAccountLimit: 1 });
    await expect(createCoupon(admin, { ...data }, prisma)).rejects.toThrow(/Já existe um cupom/);

    const preview = await previewCouponInput(data, prisma, now);
    expect(preview.plans).toEqual([expect.objectContaining({ planId: p.id, baseCents: 4990, discountCents: 998, finalCents: 3992 })]);
    expect(preview.problems).toEqual([]);
    // Pelo menos as duas canceladas pagas deste teste (o banco é compartilhado).
    expect(preview.audienceCount).toBeGreaterThanOrEqual(2);
    expect((await listCoupons({ query: tag }, prisma)).some((row) => row.id === id)).toBe(true);
  });

  it("ativar recusa plano de preço zero e desconto que zera a cobrança; depois de ativo, editar cria versão nova", async () => {
    const free = await plan(0);
    const cheap = await plan(1990);
    const zero = await createCoupon(admin, input([free.id]), prisma);
    await expect(setCouponStatus(admin, zero.id, "ATIVAR", prisma, now)).rejects.toThrow(/preço zero/);
    const total = await createCoupon(admin, input([cheap.id], { kind: "FIXED_AMOUNT", amount: 2500 }), prisma);
    await expect(setCouponStatus(admin, total.id, "ATIVAR", prisma, now)).rejects.toThrow(/zera a cobrança/);

    const ok = await createCoupon(admin, input([cheap.id]), prisma);
    await updateCoupon(admin, ok.id, input([cheap.id], { amount: 1500 }), prisma);
    expect(await getCoupon(ok.id, prisma)).toMatchObject({ version: 1, amount: 1500 });
    expect(await setCouponStatus(admin, ok.id, "ATIVAR", prisma, now)).toEqual({ status: "ACTIVE" });
    expect(await updateCoupon(admin, ok.id, input([cheap.id], { amount: 1000 }), prisma)).toMatchObject({ version: 2 });
    expect(await prisma.couponVersion.count({ where: { couponId: ok.id } })).toBe(2);

    expect(await setCouponStatus(admin, ok.id, "PAUSAR", prisma, now)).toEqual({ status: "PAUSED" });
    await expect(setCouponStatus(admin, ok.id, "ARQUIVAR", prisma, now)).rejects.toThrow(AdminError);
    expect(await setCouponStatus(admin, ok.id, "ENCERRAR", prisma, now)).toEqual({ status: "ENDED" });
    await expect(updateCoupon(admin, ok.id, input([cheap.id]), prisma)).rejects.toThrow(/encerrada/);
    const audit = (await getCoupon(ok.id, prisma)).audit.map((row) => row.operation);
    expect(audit).toEqual(["ENCERRADO", "PAUSADO", "NOVA_VERSAO", "ATIVADO", "EDITADO", "CRIADO"]);
  });

  it("selecionados: exige contas existentes do produto; busca por nome ou e-mail", async () => {
    const p = await plan(4990);
    const tenant = await account(p.id, "ATIVA", false);
    await expect(createCoupon(admin, input([p.id], { segments: ["SELECIONADOS"] }), prisma)).rejects.toThrow(/pelo menos uma conta/);
    await expect(createCoupon(admin, input([p.id], { segments: ["SELECIONADOS"], selectedTenantIds: ["nao-existe"] }), prisma)).rejects.toThrow(/não existe/);
    const { id } = await createCoupon(admin, input([p.id], { segments: ["SELECIONADOS"], selectedTenantIds: [tenant.id] }), prisma);
    expect((await getCoupon(id, prisma)).selected).toEqual([expect.objectContaining({ tenantId: tenant.id })]);
    expect((await previewCouponInput(input([p.id], { segments: ["SELECIONADOS"], selectedTenantIds: [tenant.id] }), prisma, now)).audienceCount).toBe(1);
    expect((await searchCouponAccounts(tenant.name, ["PERSONAL"], prisma)).map((row) => row.tenantId)).toContain(tenant.id);
    expect(await searchCouponAccounts(tenant.name, ["INDIVIDUAL"], prisma)).toEqual([]);
  });
});
