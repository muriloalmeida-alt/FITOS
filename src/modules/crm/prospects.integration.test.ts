// @vitest-environment node
//
// CRM de convites contra PostgreSQL real: contato com cupom próprio
// (50% por 1 mês, uso único, só Livre novo), lote com repetidos e erros,
// abertura do link, cadastro que aplica o cupom e descarte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { claimInvite, createProspect, discardProspect, importProspects, listProspects, markInvited, openInvite, peekInvite } from "./prospects";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const admin = "admin-crm";
let planId = "";
// Celulares únicos por execução (o banco de testes é compartilhado).
const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
let seq = 0;
const phone = () => `(11) 9${String(base + ++seq).slice(-8)}`;

beforeAll(async () => {
  planId = (await prisma.plan.create({ data: { slug: `livre-${run}`, audience: "INDIVIDUAL", name: "Livre teste", priceCents: 1990, billingCycle: "MENSAL" } })).id;
});

afterAll(async () => {
  const prospects = await prisma.crmProspect.findMany({ where: { name: { contains: run } }, select: { couponId: true } });
  await prisma.crmProspect.deleteMany({ where: { name: { contains: run } } });
  await prisma.couponRedemption.deleteMany({ where: { couponId: { in: prospects.map((row) => row.couponId) } } });
  await prisma.coupon.deleteMany({ where: { id: { in: prospects.map((row) => row.couponId) } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function livreAccount(label: string, type: "INDIVIDUAL" | "PERSONAL" = "INDIVIDUAL") {
  const user = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: label, role: type } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId, provider: "sem_integracao", status: "ATIVA", trialEndsAt: new Date(Date.now() + 30 * 86_400_000) } });
  return { userId: user.id, tenantId: tenant.id };
}

describe("CRM de convites", () => {
  it("contato novo ganha cupom próprio ativo: 50% por 1 ciclo, uso único, só Livre novo", async () => {
    const prospect = await createProspect(admin, { name: `Ana ${run}`, phone: phone(), email: "ana@example.test" }, prisma);
    expect(prospect.status).toBe("NOVO");
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: prospect.couponId }, include: { currentVersion: true } });
    expect(coupon.code).toMatch(/^CONHECA-[A-Z0-9]{6}$/);
    expect(coupon.status).toBe("ACTIVE");
    expect(coupon.currentVersion).toMatchObject({ kind: "PERCENT", amount: 5000, durationCycles: 1, maxRedemptions: 1, perAccountLimit: 1, products: ["INDIVIDUAL"], segments: ["NOVOS"], cycles: ["MENSAL"] });
    // Vale para os planos mensais pagos do Livre (inclui o deste teste).
    expect(coupon.currentVersion!.planIds).toContain(planId);
    await expect(createProspect(admin, { name: `Ana de novo ${run}`, phone: `+55 ${prospect.phone.slice(2)}` }, prisma)).rejects.toThrow(/já está no CRM/);
  });

  it("lote: cria os válidos, pula quem já está no CRM e aponta linhas inválidas", async () => {
    const existing = await createProspect(admin, { name: `Bia ${run}`, phone: phone() }, prisma);
    const fresh = [phone(), phone()];
    const result = await importProspects(admin, [`Caio ${run}; ${fresh[0]}`, `Bia repetida ${run}; ${existing.phone}`, `Duda ${run}, ${fresh[1]}`, `Erro ${run}; 123`].join("\n"), prisma);
    expect(result.created).toBe(2);
    expect(result.duplicates).toEqual([{ line: 2, name: `Bia repetida ${run}` }]);
    expect(result.errors).toEqual([expect.objectContaining({ line: 4 })]);
    const { rows, counts } = await listProspects({ query: run }, prisma);
    expect(rows.map((row) => row.name).sort()).toEqual([`Ana ${run}`, `Bia ${run}`, `Caio ${run}`, `Duda ${run}`].sort());
    expect(counts.NOVO).toBeGreaterThanOrEqual(4);
  });

  it("envio, abertura do link e cadastro pelo Livre: aplica o cupom e marca CADASTRADO", async () => {
    const prospect = await createProspect(admin, { name: `Edu ${run}`, phone: phone() }, prisma);
    await markInvited(prospect.id, prisma);
    expect(await prisma.crmProspect.findUniqueOrThrow({ where: { id: prospect.id } })).toMatchObject({ status: "CONVIDADO", inviteCount: 1 });
    const opened = await openInvite(prospect.token, prisma);
    expect(opened?.couponCode).toMatch(/^CONHECA-/);
    expect(await peekInvite(prospect.token, prisma)).toEqual({ couponCode: opened!.couponCode });
    await markInvited(prospect.id, prisma);
    expect(await prisma.crmProspect.findUniqueOrThrow({ where: { id: prospect.id } })).toMatchObject({ status: "ABERTO", inviteCount: 2 });

    const who = await livreAccount("edu");
    expect(await claimInvite({ token: prospect.token, ...who }, prisma)).toEqual({ claimed: true, couponApplied: true });
    expect(await prisma.crmProspect.findUniqueOrThrow({ where: { id: prospect.id } })).toMatchObject({ status: "CADASTRADO", tenantId: who.tenantId });
    expect(await prisma.couponRedemption.findFirst({ where: { tenantId: who.tenantId, couponId: prospect.couponId } })).toMatchObject({ amount: 5000, durationCycles: 1, state: "COMMITTED" });
    // Repetir é idempotente; o link já usado não vale mais.
    expect(await claimInvite({ token: prospect.token, ...who }, prisma)).toEqual({ claimed: true, couponApplied: true });
    expect(await openInvite(prospect.token, prisma)).toBeNull();
    expect(await prisma.couponRedemption.count({ where: { couponId: prospect.couponId } })).toBe(1);
  });

  it("outra conta não usa o convite de quem já se cadastrou; personal não usa convite do Livre", async () => {
    const prospect = await createProspect(admin, { name: `Fê ${run}`, phone: phone() }, prisma);
    const first = await livreAccount("fe");
    await claimInvite({ token: prospect.token, ...first }, prisma);
    const second = await livreAccount("intrusa");
    expect(await claimInvite({ token: prospect.token, ...second }, prisma)).toEqual({ claimed: false, couponApplied: false });
    const other = await createProspect(admin, { name: `Gil ${run}`, phone: phone() }, prisma);
    const personal = await livreAccount("gil", "PERSONAL");
    expect(await claimInvite({ token: other.token, ...personal }, prisma)).toEqual({ claimed: false, couponApplied: false });
  });

  it("descartar encerra o cupom e invalida o link; quem já se cadastrou não é descartado", async () => {
    const prospect = await createProspect(admin, { name: `Hugo ${run}`, phone: phone() }, prisma);
    await discardProspect(admin, prospect.id, prisma);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: prospect.couponId } })).status).toBe("ENDED");
    expect(await openInvite(prospect.token, prisma)).toBeNull();
    await expect(markInvited(prospect.id, prisma)).rejects.toThrow(/descartado/);
    const signed = await createProspect(admin, { name: `Iara ${run}`, phone: phone() }, prisma);
    await claimInvite({ token: signed.token, ...(await livreAccount("iara")) }, prisma);
    await expect(discardProspect(admin, signed.id, prisma)).rejects.toThrow(/já se cadastrou/);
  });
});
