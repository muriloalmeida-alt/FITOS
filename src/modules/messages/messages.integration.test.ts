// @vitest-environment node
//
// Chat aluno ↔ personal por assunto (EPIC-39) contra PostgreSQL real, com
// push falso: abrir assunto com categoria e exercício, não lidas dos dois
// lados, resolver e reabrir, e o isolamento entre alunos e espaços.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, type Sender } from "@/modules/notifications/push";
import { createTopic, getThread, listTopics, postMessage, setResolved, unreadTopicsCount, type ChatViewer } from "./messages";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.chatMessage.deleteMany({ where });
  await prisma.chatTopic.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

function recorder() {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
  const sender: Sender = async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, sender };
}

async function space(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/dono-${label}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
  const pupil = async (name: string) => {
    const user = await prisma.user.create({ data: { email: `${label}-${name}-${run}@example.test`.toLowerCase(), name, role: "ALUNO" } });
    await saveSubscription({ userId: user.id, subscription: { endpoint: `https://push.example/${label}-${name}-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
    const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: `${name} Costa` } });
    const viewer: ChatViewer = { role: "ALUNO", userId: user.id, tenantId: tenant.id, studentId: student.id };
    return { student, viewer };
  };
  const coach: ChatViewer = { role: "PERSONAL", userId: owner.id, tenantId: tenant.id };
  return { tenant, coach, pupil };
}

describe("chat por assunto (EPIC-39)", () => {
  it("aluno pergunta sobre um exercício; personal recebe push, lê e responde", async () => {
    const { tenant, coach, pupil } = await space("fluxo");
    const ana = await pupil("Ana");
    const exercise = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino reto ${run}`, origin: "PERSONAL" } });
    const box = recorder();

    const { id } = await createTopic(ana.viewer, { category: "EXERCICIO", exerciseId: exercise.id, body: "  Senti no ombro na descida.  " }, { client: prisma, sender: box.sender, config });
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0]!.endpoint).toContain(`dono-fluxo-${run}`);
    expect(box.sent[0]!.payload).toMatchObject({ title: `Ana · Supino reto ${run}`, body: "Senti no ombro na descida.", url: `/painel/mensagens/${id}` });

    expect(await unreadTopicsCount(coach, prisma)).toBe(1);
    expect(await unreadTopicsCount(ana.viewer, prisma)).toBe(0);
    const [summary] = await listTopics(coach, {}, prisma);
    expect(summary).toMatchObject({ id, category: "EXERCICIO", title: `Supino reto ${run}`, studentName: "Ana Costa", unread: true, lastFromMe: false, resolved: false });

    const thread = await getThread(coach, id, prisma);
    expect(thread.messages).toEqual([expect.objectContaining({ body: "Senti no ombro na descida.", mine: false })]);
    expect(await unreadTopicsCount(coach, prisma)).toBe(0);

    await postMessage(coach, id, "Abra menos os cotovelos e desça até 90°.", { client: prisma, sender: box.sender, config });
    expect(box.sent[1]!.endpoint).toContain(`fluxo-Ana-${run}`);
    expect(box.sent[1]!.payload.title).toBe(`Murilo · Supino reto ${run}`);
    expect(await unreadTopicsCount(ana.viewer, prisma)).toBe(1);
    expect((await getThread(ana.viewer, id, prisma)).messages.map((message) => message.mine)).toEqual([true, false]);
    expect(await unreadTopicsCount(ana.viewer, prisma)).toBe(0);
  });

  it("resolver e reabrir com uma nova mensagem", async () => {
    const { coach, pupil } = await space("resolve");
    const ana = await pupil("Ana");
    const deps = { client: prisma, sender: recorder().sender, config };
    const { id } = await createTopic(ana.viewer, { category: "AGENDA", body: "Não vou na quinta." }, deps);
    await setResolved(coach, id, true, prisma);
    expect((await listTopics(ana.viewer, {}, prisma))[0]).toMatchObject({ title: "Agenda", resolved: true });
    await postMessage(ana.viewer, id, "Posso ir sexta?", deps);
    expect((await listTopics(ana.viewer, {}, prisma))[0]!.resolved).toBe(false);
  });

  it("valida categoria, texto e exercício de outro espaço", async () => {
    const { pupil } = await space("valida");
    const other = await space("valida-outro");
    const ana = await pupil("Ana");
    const foreign = await prisma.exercise.create({ data: { tenantId: other.tenant.id, name: `Leg press ${run}`, origin: "PERSONAL" } });
    const deps = { client: prisma, sender: recorder().sender, config };
    await expect(createTopic(ana.viewer, { category: "XYZ", body: "oi" }, deps)).rejects.toThrow("Escolha sobre o que é a mensagem.");
    await expect(createTopic(ana.viewer, { category: "OUTRO", body: "   " }, deps)).rejects.toThrow("Escreva a mensagem.");
    await expect(createTopic(ana.viewer, { category: "OUTRO", body: "x".repeat(2001) }, deps)).rejects.toThrow("até 2000 caracteres");
    await expect(createTopic(ana.viewer, { category: "EXERCICIO", exerciseId: foreign.id, body: "oi" }, deps)).rejects.toThrow("Exercício não encontrado.");
  });

  it("isolamento: aluno só vê os próprios assuntos; outro personal não vê nada", async () => {
    const { coach, pupil } = await space("isola");
    const intruder = await space("isola-outro");
    const ana = await pupil("Ana");
    const pedro = await pupil("Pedro");
    const deps = { client: prisma, sender: recorder().sender, config };
    const { id } = await createTopic(ana.viewer, { category: "DOR", body: "Dor no joelho." }, deps);
    await createTopic(coach, { category: "TREINO", body: "Como foi a semana?", studentId: pedro.student.id }, deps);

    expect((await listTopics(coach, {}, prisma)).map((topic) => topic.studentName).sort()).toEqual(["Ana Costa", "Pedro Costa"]);
    expect((await listTopics(coach, { studentId: pedro.student.id }, prisma)).map((topic) => topic.title)).toEqual(["Treino"]);
    expect((await listTopics(coach, { category: "DOR" }, prisma)).map((topic) => topic.id)).toEqual([id]);
    expect(await listTopics(pedro.viewer, {}, prisma)).toHaveLength(1);
    await expect(getThread(pedro.viewer, id, prisma)).rejects.toThrow("Conversa não encontrada.");
    await expect(postMessage(pedro.viewer, id, "oi", deps)).rejects.toThrow("Conversa não encontrada.");
    await expect(setResolved(pedro.viewer, id, true, prisma)).rejects.toThrow("Conversa não encontrada.");

    expect(await listTopics(intruder.coach, {}, prisma)).toEqual([]);
    await expect(getThread(intruder.coach, id, prisma)).rejects.toThrow("Conversa não encontrada.");
    await expect(createTopic(intruder.coach, { category: "OUTRO", body: "oi", studentId: ana.student.id }, deps)).rejects.toThrow("Aluno não encontrado.");
  });
});
