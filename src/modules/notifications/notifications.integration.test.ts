// @vitest-environment node
//
// Notificações push (EPIC-31) contra PostgreSQL real, com um "serviço de
// push" falso no lugar do envio de verdade.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, sendToUser, type Sender } from "./push";
import { localClock, runDueReminders, setReminderHour } from "./reminders";
import { setPreferredDays } from "@/modules/students/preferredDays";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.workoutSession.deleteMany({ where });
  await prisma.planAssignment.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

function recorder(failWith?: number) {
  const sent: { endpoint: string; payload: Record<string, string> }[] = [];
  const sender: Sender = async (subscription, payload) => {
    if (failWith) throw Object.assign(new Error("push"), { statusCode: failWith });
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, sender };
}

async function alunoWithPlan(label: string, days: string[]) {
  const owner = await prisma.user.create({ data: { email: `personal-${label}-${run}@example.test`, name: "Joana Lima", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}`, type: "PERSONAL" } });
  const user = await prisma.user.create({ data: { email: `aluno-${label}-${run}@example.test`, name: "Ana Costa", role: "ALUNO" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: "Ana Costa" } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia" } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0, suggestedDays: days } });
  await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id } });
  await saveSubscription({ userId: user.id, subscription: { endpoint: `https://push.example/${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  return { owner, tenant, user, student, workout };
}

describe("push (EPIC-31)", () => {
  it("entrega em todos os aparelhos e apaga o que o serviço diz não existir mais", async () => {
    const { user } = await alunoWithPlan("envio", ["SEGUNDA"]);
    await saveSubscription({ userId: user.id, subscription: { endpoint: `https://push.example/2-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: "Chrome" }, prisma);
    const ok = recorder();
    expect(await sendToUser(user.id, { title: "Oi", body: "x", url: "/painel" }, { client: prisma, sender: ok.sender, config })).toBe(2);
    expect(ok.sent[0]!.payload).toMatchObject({ title: "Oi", url: "/painel" });

    const gone = recorder(410);
    expect(await sendToUser(user.id, { title: "Oi", body: "x", url: "/painel" }, { client: prisma, sender: gone.sender, config })).toBe(0);
    expect(await prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(0);
  });

  it("sem chaves VAPID não envia nada", async () => {
    const { user } = await alunoWithPlan("sem-chave", ["SEGUNDA"]);
    expect(await sendToUser(user.id, { title: "Oi", body: "x", url: "/" }, { client: prisma, sender: recorder().sender, config: null })).toBe(0);
  });
});

describe("lembrete de treino (EPIC-31)", () => {
  // Segunda, 5 de outubro de 2026, 7h10 em Brasília.
  const now = new Date("2026-10-05T10:10:00.000Z");

  it("hora e dia de Brasília", () => {
    expect(localClock(now)).toMatchObject({ hour: 7, dateKey: "2026-10-05", weekday: "SEGUNDA" });
    expect(localClock(new Date("2026-10-05T02:30:00.000Z"))).toMatchObject({ hour: 23, dateKey: "2026-10-04", weekday: "DOMINGO" });
  });

  it("manda uma vez no dia de treino, na hora escolhida, com o nome do treino", async () => {
    const { user } = await alunoWithPlan("lembrete", ["SEGUNDA", "QUINTA"]);
    await setReminderHour(user.id, 7, prisma);
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    const mine = box.sent.filter((entry) => entry.endpoint.includes(`lembrete-${run}`));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.payload).toMatchObject({ title: "Hora do treino", body: "Hoje: Treino A. Bora?" });

    const again = recorder();
    await runDueReminders({ now: new Date(now.getTime() + 5 * 60_000), client: prisma, sender: again.sender, config });
    expect(again.sent.filter((entry) => entry.endpoint.includes(`lembrete-${run}`))).toHaveLength(0);
  });

  it("não manda fora dos dias, fora da hora ou se já treinou hoje", async () => {
    const off = await alunoWithPlan("folga", ["TERCA"]);
    await setReminderHour(off.user.id, 7, prisma);
    const late = await alunoWithPlan("outra-hora", ["SEGUNDA"]);
    await setReminderHour(late.user.id, 18, prisma);
    const trained = await alunoWithPlan("treinou", ["SEGUNDA"]);
    await setReminderHour(trained.user.id, 7, prisma);
    await prisma.workoutSession.create({ data: { tenantId: trained.tenant.id, studentId: trained.student.id, workoutId: trained.workout.id, status: "CONCLUIDA", startedAt: new Date("2026-10-05T09:30:00.000Z") } });

    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.sent.filter((entry) => /(folga|outra-hora|treinou)-/.test(entry.endpoint))).toHaveLength(0);
  });

  it("os dias escolhidos pelo aluno substituem os do programa", async () => {
    const { user, tenant, student } = await alunoWithPlan("meus-dias", ["TERCA"]);
    await setReminderHour(user.id, 7, prisma);
    await setPreferredDays({ tenantId: tenant.id, studentId: student.id, days: ["SEGUNDA"], notifyPersonal: false }, { client: prisma, config: null });
    const box = recorder();
    await runDueReminders({ now, client: prisma, sender: box.sender, config });
    expect(box.sent.filter((entry) => entry.endpoint.includes(`meus-dias-${run}`))).toHaveLength(1);
  });
});

describe("Meus dias (EPIC-31)", () => {
  it("guarda em ordem e avisa o personal só quando muda", async () => {
    const { owner, tenant, student } = await alunoWithPlan("avisa", ["SEGUNDA"]);
    await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/personal-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
    const box = recorder();
    const result = await setPreferredDays({ tenantId: tenant.id, studentId: student.id, days: ["SEXTA", "SEGUNDA", "QUARTA"], notifyPersonal: true }, { client: prisma, sender: box.sender, config });
    expect(result).toEqual({ days: ["SEGUNDA", "QUARTA", "SEXTA"], notified: true });
    expect(box.sent[0]!.payload).toMatchObject({ title: "Ana mudou os dias de treino", body: "Agora: seg, qua, sex.", url: `/painel/alunos/${student.id}` });

    const same = recorder();
    await setPreferredDays({ tenantId: tenant.id, studentId: student.id, days: ["SEGUNDA", "QUARTA", "SEXTA"], notifyPersonal: true }, { client: prisma, sender: same.sender, config });
    expect(same.sent).toHaveLength(0);
    await expect(setPreferredDays({ tenantId: tenant.id, studentId: student.id, days: ["seg"], notifyPersonal: true }, { client: prisma, config })).rejects.toThrow("Dias inválidos.");
  });
});
