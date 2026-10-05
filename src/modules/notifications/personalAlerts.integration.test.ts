// @vitest-environment node
//
// Avisos escolhidos pelo personal (EPIC-36) contra PostgreSQL real, com um
// serviço de push falso: aluno sem treinar, mensalidade atrasada, programa
// que terminou e o aviso de "mudou os dias" desligável.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { setPreferredDays } from "@/modules/students/preferredDays";
import { saveSubscription, type Sender } from "./push";
import { getAlertSettings, inactiveMessage, runPersonalAlerts, setAlertSettings } from "./personalAlerts";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };
const DAY = 86_400_000;
// Segunda, 5 de outubro de 2026, 10h em Brasília.
const now = new Date("2026-10-05T13:00:00.000Z");

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.studentCharge.deleteMany({ where });
  await prisma.planAssignment.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

function recorder() {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
  const sender: Sender = async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, sender, mine: (label: string) => sent.filter((entry) => entry.endpoint.includes(`${label}-${run}`)).map((entry) => entry.payload) };
}

async function personal(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  return { owner, tenant };
}

async function student(tenantId: string, name: string, label: string, opts: { assignedDaysAgo?: number; weeks?: number } = {}) {
  const user = await prisma.user.create({ data: { email: `${label}-${name}-${run}@example.test`.toLowerCase(), name, role: "ALUNO" } });
  const created = await prisma.student.create({ data: { tenantId, userId: user.id, email: user.email, displayName: `${name} Silva` } });
  if (opts.assignedDaysAgo !== undefined) {
    const plan = await prisma.trainingPlan.create({ data: { tenantId, name: "Hipertrofia 8 semanas", durationWeeks: opts.weeks ?? 8 } });
    await prisma.planAssignment.create({ data: { tenantId, studentId: created.id, trainingPlanId: plan.id, assignedAt: new Date(now.getTime() - opts.assignedDaysAgo * DAY) } });
  }
  return created;
}

describe("configuração dos avisos (EPIC-36)", () => {
  it("vem ligada por padrão e salva só o que mudou", async () => {
    const { owner } = await personal("cfg");
    expect(await getAlertSettings(owner.id, prisma)).toEqual({ daysChanged: true, inactiveDays: 7, overdue: true, programEnd: true });
    expect(await setAlertSettings(owner.id, { inactiveDays: 3, overdue: false }, prisma)).toEqual({ daysChanged: true, inactiveDays: 3, overdue: false, programEnd: true });
    expect(await setAlertSettings(owner.id, { inactiveDays: null }, prisma)).toMatchObject({ inactiveDays: null, overdue: false });
    await expect(setAlertSettings(owner.id, { inactiveDays: 4 }, prisma)).rejects.toThrow("Escolha 3, 5, 7 ou 14 dias.");
  });

  it("mensagem agrupa os alunos", () => {
    const hit = (name: string) => ({ refKey: name, studentId: name, name: `${name} Silva` });
    expect(inactiveMessage(7, [hit("Ana")]).title).toBe("Ana está há 7 dias sem treinar");
    expect(inactiveMessage(7, ["Ana", "Pedro", "Camila", "Rafa"].map(hit))).toMatchObject({ title: "4 alunos sem treinar há 7 dias", body: "Ana, Pedro e mais 2.", url: "/painel/alunos" });
  });
});

describe("avisos do personal (EPIC-36)", () => {
  it("aluno sem treinar: avisa uma vez, depois de N dias, só quem tem programa e conta", async () => {
    const { tenant } = await personal("inativo");
    await student(tenant.id, "Ana", "inativo", { assignedDaysAgo: 9 });
    await student(tenant.id, "Pedro", "inativo", { assignedDaysAgo: 2 });
    await student(tenant.id, "Camila", "inativo");

    const box = recorder();
    await runPersonalAlerts({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("inativo")).toEqual([{ title: "Ana está há 7 dias sem treinar", body: "Uma mensagem agora costuma trazer o aluno de volta.", url: expect.stringMatching(/^\/painel\/alunos\//), tag: "aviso-inativo" }]);

    const again = recorder();
    await runPersonalAlerts({ now: new Date(now.getTime() + 60 * 60_000), client: prisma, sender: again.sender, config });
    expect(again.mine("inativo")).toEqual([]);
  });

  it("antes das 9h não manda nada", async () => {
    const { tenant } = await personal("cedo");
    await student(tenant.id, "Ana", "cedo", { assignedDaysAgo: 20 });
    const box = recorder();
    await runPersonalAlerts({ now: new Date("2026-10-05T10:00:00.000Z"), client: prisma, sender: box.sender, config });
    expect(box.mine("cedo")).toEqual([]);
  });

  it("mensalidade atrasada e programa que terminou, respeitando o que o personal desligou", async () => {
    const { owner, tenant } = await personal("atraso");
    const ana = await student(tenant.id, "Ana", "atraso", { assignedDaysAgo: 60, weeks: 8 });
    await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: ana.id, description: "Mensalidade", amountCents: 15000, referenceMonth: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-02T15:00:00Z") } });
    await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: ana.id, description: "Antiga", amountCents: 15000, referenceMonth: new Date("2026-07-01T00:00:00Z"), dueDate: new Date("2026-07-02T15:00:00Z") } });
    await setAlertSettings(owner.id, { inactiveDays: null }, prisma);

    const box = recorder();
    await runPersonalAlerts({ now, client: prisma, sender: box.sender, config });
    expect(box.mine("atraso")).toEqual([
      { title: "Mensalidade de Ana atrasou", body: "R$ 150,00 venceu em 02/10.", url: "/painel/financeiro", tag: "aviso-atraso" },
      { title: "O programa de Ana terminou", body: "Hipertrofia 8 semanas chegou ao fim. Hora de montar o próximo.", url: `/painel/alunos/${ana.id}`, tag: "aviso-programa" },
    ]);

    const { tenant: other, owner: otherOwner } = await personal("desligado");
    const pedro = await student(other.id, "Pedro", "desligado", { assignedDaysAgo: 60, weeks: 4 });
    await prisma.studentCharge.create({ data: { tenantId: other.id, studentId: pedro.id, description: "Mensalidade", amountCents: 15000, referenceMonth: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-01T15:00:00Z") } });
    await setAlertSettings(otherOwner.id, { inactiveDays: null, overdue: false, programEnd: false }, prisma);
    const off = recorder();
    await runPersonalAlerts({ now, client: prisma, sender: off.sender, config });
    expect(off.mine("desligado")).toEqual([]);
  });

  it("aluno mudou os dias: avisa, a menos que o personal tenha desligado", async () => {
    const { owner, tenant } = await personal("dias");
    const ana = await student(tenant.id, "Ana", "dias");
    const box = recorder();
    expect((await setPreferredDays({ tenantId: tenant.id, studentId: ana.id, days: ["SEGUNDA"], notifyPersonal: true }, { client: prisma, sender: box.sender, config })).notified).toBe(true);
    await setAlertSettings(owner.id, { daysChanged: false }, prisma);
    expect((await setPreferredDays({ tenantId: tenant.id, studentId: ana.id, days: ["TERCA"], notifyPersonal: true }, { client: prisma, sender: box.sender, config })).notified).toBe(false);
    expect(box.mine("dias")).toHaveLength(1);
  });
});
