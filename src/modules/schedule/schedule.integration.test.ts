// @vitest-environment node
//
// Agenda (EPIC-48) contra PostgreSQL real, com push falso.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, type Sender } from "@/modules/notifications/push";
import { addDays, dayLabel, localDate, mondayOf, parseTime, toInstant, weekdayOf } from "@/shared/lib/scheduleTime";
import { createExtra, createSlots, endSlot, listOccurrences, nextOccurrencesForStudent, rescheduleOccurrence, setOccurrenceStatus, studentCancel } from "./schedule";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };
// Segunda, 5 de outubro de 2026, 10h em Brasília.
const now = new Date("2026-10-05T13:00:00Z");

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.scheduleEvent.deleteMany({ where });
  await prisma.scheduleSlot.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

function recorder() {
  const sent: { endpoint: string; payload: { title: string; body: string } }[] = [];
  const sender: Sender = async (subscription, payload) => void sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  return { sent, sender };
}

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
  await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/dono-${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const user = await prisma.user.create({ data: { email: `ana-${label}-${run}@example.test`, name: "Ana", role: "ALUNO" } });
  await saveSubscription({ userId: user.id, subscription: { endpoint: `https://push.example/ana-${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  const ana = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: "Ana Costa" } });
  const bia = await prisma.student.create({ data: { tenantId: tenant.id, email: `bia-${label}-${run}@example.test`, displayName: "Bia Lima" } });
  return { owner, tenant, user, ana, bia };
}

describe("horário (EPIC-48)", () => {
  it("datas e horas em Brasília", () => {
    expect(localDate(new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05");
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(toInstant("2026-10-05", 7 * 60).toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(parseTime("07:30")).toBe(450);
    expect(parseTime("25:00")).toBeNull();
    expect(dayLabel("2026-10-08")).toBe("qui, 8/out");
  });
});

describe("agenda (EPIC-48)", () => {
  it("horário fixo gera as aulas da semana; feita, falta e voltar para agendada", async () => {
    const { owner, tenant, ana, bia } = await setup("fixo");
    const { ids: anaSlots } = await createSlots({ tenantId: tenant.id, studentId: ana.id, weekdays: [1, 4], startMinutes: 420, durationMinutes: 60, location: "Academia Centro", now }, prisma);
    await createSlots({ tenantId: tenant.id, studentId: bia.id, weekdays: [1], startMinutes: 1080, now }, prisma);
    const week = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-11" }, prisma);
    expect(week.map((item) => `${item.date} ${item.startMinutes} ${item.studentName}`)).toEqual(["2026-10-05 420 Ana Costa", "2026-10-05 1080 Bia Lima", "2026-10-08 420 Ana Costa"]);
    // Antes de criar o horário, nada aparece.
    expect(await listOccurrences({ tenantId: tenant.id, from: "2026-09-28", to: "2026-10-04" }, prisma)).toEqual([]);

    const deps = { client: prisma, config: null };
    await setOccurrenceStatus({ tenantId: tenant.id, actorUserId: owner.id, ref: week[0]!.ref, status: "FEITA" }, deps);
    await setOccurrenceStatus({ tenantId: tenant.id, actorUserId: owner.id, ref: week[1]!.ref, status: "FALTA" }, deps);
    let after = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-05" }, prisma);
    expect(after.map((item) => item.status)).toEqual(["FEITA", "FALTA"]);
    await setOccurrenceStatus({ tenantId: tenant.id, actorUserId: owner.id, ref: week[1]!.ref, status: "AGENDADA" }, deps);
    after = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-05" }, prisma);
    expect(after[1]!.status).toBe("AGENDADA");

    // Ocorrência que não existe (dia errado) não é aceita.
    const slotId = week[0]!.ref.split(":")[1];
    await expect(setOccurrenceStatus({ tenantId: tenant.id, actorUserId: owner.id, ref: `slot:${slotId}:2026-10-06`, status: "FEITA" }, deps)).rejects.toThrow("Aula não encontrada.");
    await expect(setOccurrenceStatus({ tenantId: tenant.id, actorUserId: owner.id, ref: week[0]!.ref, status: "XYZ" }, deps)).rejects.toThrow("Situação inválida.");

    // Encerrar o horário tira as próximas, sem apagar o histórico.
    for (const id of anaSlots) await endSlot({ tenantId: tenant.id, slotId: id, now: new Date("2026-10-06T12:00:00Z") }, prisma);
    await expect(endSlot({ tenantId: tenant.id, slotId: slotId!, now }, prisma)).rejects.toThrow("Horário não encontrado.");
    const later = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-18" }, prisma);
    expect(later.filter((item) => item.studentName === "Ana Costa").map((item) => item.date)).toEqual(["2026-10-05"]);
  });

  it("remarcar desmarca a original, cria a reposição e avisa o aluno", async () => {
    const { owner, tenant, ana } = await setup("remarca");
    await createSlots({ tenantId: tenant.id, studentId: ana.id, weekdays: [3], startMinutes: 420, now }, prisma);
    const [wednesday] = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-11" }, prisma);
    const box = recorder();
    const { ref } = await rescheduleOccurrence({ tenantId: tenant.id, actorUserId: owner.id, ref: wednesday!.ref, date: "2026-10-09", startMinutes: 1110 }, { client: prisma, sender: box.sender, config });
    const week = await listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2026-10-11" }, prisma);
    expect(week.map((item) => [item.date, item.status, item.extra, item.note])).toEqual([
      ["2026-10-07", "DESMARCADA", false, "Remarcada para sex, 9/out às 18:30"],
      ["2026-10-09", "AGENDADA", true, "Reposição de qua, 7/out"],
    ]);
    expect(week[1]!.ref).toBe(ref);
    expect(box.sent[0]!.payload).toMatchObject({ title: "Murilo remarcou a aula", body: "qua, 7/out às 07:00 → sex, 9/out às 18:30" });
  });

  it("aluno avisa que não vai: só a própria aula futura; personal é avisado", async () => {
    const { tenant, user, ana, bia } = await setup("naovou");
    await createSlots({ tenantId: tenant.id, studentId: ana.id, weekdays: [1, 2], startMinutes: 420, now }, prisma);
    await createSlots({ tenantId: tenant.id, studentId: bia.id, weekdays: [2], startMinutes: 480, now }, prisma);
    const next = await nextOccurrencesForStudent({ tenantId: tenant.id, studentId: ana.id, now }, prisma);
    // Hoje às 7h já passou (agora são 10h): a primeira é terça.
    expect(next[0]!.date).toBe("2026-10-06");
    const box = recorder();
    const deps = { client: prisma, sender: box.sender, config, now };
    await studentCancel({ tenantId: tenant.id, studentId: ana.id, userId: user.id, ref: next[0]!.ref, reason: "Médico" }, deps);
    expect((await nextOccurrencesForStudent({ tenantId: tenant.id, studentId: ana.id, now }, prisma))[0]).toMatchObject({ status: "DESMARCADA", note: "Aluno avisou: Médico" });
    expect(box.sent[0]!.payload).toMatchObject({ title: "Ana não vai na aula", body: "ter, 6/out às 07:00 · Médico" });

    const today = (await listOccurrences({ tenantId: tenant.id, studentId: ana.id, from: "2026-10-05", to: "2026-10-05" }, prisma))[0]!;
    await expect(studentCancel({ tenantId: tenant.id, studentId: ana.id, userId: user.id, ref: today.ref }, deps)).rejects.toThrow("Essa aula já começou.");
    const biaTuesday = (await listOccurrences({ tenantId: tenant.id, studentId: bia.id, from: "2026-10-06", to: "2026-10-06" }, prisma))[0]!;
    await expect(studentCancel({ tenantId: tenant.id, studentId: ana.id, userId: user.id, ref: biaTuesday.ref }, deps)).rejects.toThrow("Aula não encontrada.");
  });

  it("aula avulsa e validações; outro espaço não enxerga", async () => {
    const { owner, tenant, ana } = await setup("avulsa");
    const other = await setup("avulsa-outro");
    const box = recorder();
    await createExtra({ tenantId: tenant.id, actorUserId: owner.id, studentId: ana.id, date: "2026-10-10", startMinutes: 540, durationMinutes: 45 }, { client: prisma, sender: box.sender, config });
    expect(box.sent[0]!.payload).toMatchObject({ title: "Aula marcada com Murilo", body: "sáb, 10/out às 09:00" });
    expect(await listOccurrences({ tenantId: other.tenant.id, from: "2026-10-05", to: "2026-10-11" }, prisma)).toEqual([]);
    const deps = { client: prisma, config: null };
    await expect(createExtra({ tenantId: other.tenant.id, actorUserId: other.owner.id, studentId: ana.id, date: "2026-10-10", startMinutes: 540 }, deps)).rejects.toThrow("Aluno não encontrado.");
    await expect(createExtra({ tenantId: tenant.id, actorUserId: owner.id, studentId: ana.id, date: "2026-02-30", startMinutes: 540 }, deps)).rejects.toThrow("Data inválida.");
    await expect(createExtra({ tenantId: tenant.id, actorUserId: owner.id, studentId: ana.id, date: "2026-10-10", startMinutes: 541 }, deps)).rejects.toThrow("Horário inválido.");
    await expect(createSlots({ tenantId: tenant.id, studentId: ana.id, weekdays: [], startMinutes: 420 }, prisma)).rejects.toThrow("Escolha os dias.");
    await expect(listOccurrences({ tenantId: tenant.id, from: "2026-10-05", to: "2027-10-05" }, prisma)).rejects.toThrow("Período inválido.");
  });
});
