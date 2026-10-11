// @vitest-environment node
//
// Aviso de vencimento da assinatura (EPIC-34) contra PostgreSQL real, com
// um serviço de push falso.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, type Sender } from "./push";
import { dueReminderMessage, runDueReminders } from "./billingReminders";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.subscriptionDueReminder.deleteMany({ where });
  await prisma.saasSubscription.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

function recorder() {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
  const sender: Sender = async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, sender, mine: (label: string) => sent.filter((entry) => entry.endpoint.includes(`${label}-${run}`)) };
}

async function customer(label: string, opts: { trialEndsAt: Date; card?: boolean; status?: "ATIVA" | "CANCELADA" }) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const plan = await prisma.plan.create({ data: { slug: `p-${label}-${run}`, name: "Personal 20", audience: "PERSONAL", priceCents: 4990, billingCycle: "MENSAL", studentLimit: 20, trialDays: 30, active: true } });
  await prisma.saasSubscription.create({
    data: { tenantId: tenant.id, planId: plan.id, status: opts.status ?? "ATIVA", provider: "sem_integracao", trialEndsAt: opts.trialEndsAt, trialUsedAt: new Date(), ...(opts.card ? { creditCardLast4: "4242", creditCardBrand: "VISA" } : {}) },
  });
  await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  return tenant;
}

describe("mensagem de vencimento (EPIC-34)", () => {
  it("cinco dias antes e no dia, com e sem cartão", () => {
    const common = { planName: "Personal 20", priceCents: 4990, dueOn: "2026-10-14" };
    expect(dueReminderMessage({ ...common, kind: "5_DIAS", card: { brand: "VISA", last4: "4242" } })).toMatchObject({ title: "Sua assinatura vence em 5 dias", body: "Personal 20: R$\u00a049,90 no dia 14/10, no cartão VISA •••• 4242.", url: "/painel/assinatura" });
    expect(dueReminderMessage({ ...common, kind: "5_DIAS", card: null }).body).toBe("Personal 20: R$\u00a049,90 no dia 14/10. Você ainda não tem cartão cadastrado: cadastre agora para não perder o acesso.");
    expect(dueReminderMessage({ ...common, kind: "NO_DIA", card: { brand: "VISA", last4: "4242" } })).toMatchObject({ title: "Hoje é o dia do débito", body: "Personal 20: R$\u00a049,90 no cartão VISA •••• 4242." });
    expect(dueReminderMessage({ ...common, kind: "NO_DIA", card: null })).toMatchObject({ title: "Sua assinatura vence hoje", body: "Personal 20: R$\u00a049,90. Não há cartão cadastrado: cadastre agora para continuar usando o FitOS." });
  });
});

describe("aviso de vencimento (EPIC-34)", () => {
  // Segunda, 5 de outubro de 2026, 10h em Brasília.
  const now = new Date("2026-10-05T13:00:00.000Z");

  it("5 dias antes, sem cartão: avisa e pede o cartão, uma vez só", async () => {
    await customer("cinco", { trialEndsAt: new Date("2026-10-10T15:00:00.000Z") });
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("cinco")).toHaveLength(1);
    expect(box.mine("cinco")[0]!.payload.body).toContain("cadastre agora");

    const again = recorder();
    await runDueReminders({ now: new Date(now.getTime() + 60 * 60_000), client: prisma, sender: again.sender, config });
    expect(again.mine("cinco")).toHaveLength(0);
  });

  it("no dia do débito, com cartão: avisa o débito no cartão", async () => {
    await customer("hoje", { trialEndsAt: new Date("2026-10-05T20:00:00.000Z"), card: true });
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("hoje")[0]!.payload).toMatchObject({ title: "Hoje é o dia do débito", body: expect.stringContaining("•••• 4242") });
  });

  it("vencimento mensal depois do teste também avisa", async () => {
    await customer("mensal", { trialEndsAt: new Date("2026-09-10T15:00:00.000Z"), card: true });
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("mensal")[0]!.payload.title).toBe("Sua assinatura vence em 5 dias");
  });

  it("não avisa antes das 9h, fora das datas nem assinatura cancelada", async () => {
    await customer("cedo", { trialEndsAt: new Date("2026-10-10T15:00:00.000Z") });
    await customer("longe", { trialEndsAt: new Date("2026-10-20T15:00:00.000Z") });
    await customer("cancelada", { trialEndsAt: new Date("2026-10-10T15:00:00.000Z"), status: "CANCELADA" });
    const early = recorder();
    await runDueReminders({ now: new Date("2026-10-05T10:30:00.000Z"), client: prisma, sender: early.sender, config });
    expect(early.mine("cedo")).toHaveLength(0);
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("longe")).toHaveLength(0);
    expect(box.mine("cancelada")).toHaveLength(0);
    expect(box.mine("cedo")).toHaveLength(1);
  });
});
