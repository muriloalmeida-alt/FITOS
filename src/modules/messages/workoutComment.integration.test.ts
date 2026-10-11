// @vitest-environment node
//
// Comentário depois do treino (EPIC-42) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { commentOnWorkout, getThread, listTopics, workoutContextLine, type ChatViewer } from "./messages";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const deps = { client: prisma, config: null };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.chatMessage.deleteMany({ where });
  await prisma.chatTopic.deleteMany({ where });
  await prisma.workoutSession.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia" } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
  const pupil = async (name: string) => {
    const user = await prisma.user.create({ data: { email: `${label}-${name}-${run}@example.test`.toLowerCase(), name, role: "ALUNO" } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: name } });
    const viewer: ChatViewer = { role: "ALUNO", userId: user.id, tenantId: tenant.id, studentId: student.id };
    return { student, viewer };
  };
  const session = (studentId: string, status: "CONCLUIDA" | "EM_ANDAMENTO" = "CONCLUIDA") =>
    prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId, workoutId: workout.id, status, perceivedEffort: 4, activeSeconds: 2520, endedAt: status === "CONCLUIDA" ? new Date() : null } });
  return { coach: { role: "PERSONAL", userId: owner.id, tenantId: tenant.id } as ChatViewer, pupil, session };
}

describe("comentário depois do treino (EPIC-42)", () => {
  it("linha de contexto", () => {
    expect(workoutContextLine({ perceivedEffort: 4, activeSeconds: 2520 })).toBe("Esforço 4/5 (Puxado) · 42 min");
    expect(workoutContextLine({ perceivedEffort: null, activeSeconds: null })).toBe("");
  });

  it("vira assunto Treino com contexto; comentar de novo responde no mesmo", async () => {
    const { coach, pupil, session } = await setup("fluxo");
    const ana = await pupil("Ana");
    const done = await session(ana.student.id);
    const { id } = await commentOnWorkout(ana.viewer, { sessionId: done.id, body: "O supino pesou." }, deps);
    const [topic] = await listTopics(coach, {}, prisma);
    expect(topic).toMatchObject({ id, category: "TREINO", title: "Como foi: Treino A", unread: true });
    expect((await getThread(coach, id, prisma)).messages[0]!.body).toBe("Esforço 4/5 (Puxado) · 42 min\nO supino pesou.");

    expect((await commentOnWorkout(ana.viewer, { sessionId: done.id, body: "E o joelho ok." }, deps)).id).toBe(id);
    expect((await getThread(coach, id, prisma)).messages.map((message) => message.body).at(-1)).toBe("E o joelho ok.");
  });

  it("só a própria sessão concluída", async () => {
    const { coach, pupil, session } = await setup("escopo");
    const ana = await pupil("Ana");
    const pedro = await pupil("Pedro");
    const running = await session(ana.student.id, "EM_ANDAMENTO");
    const others = await session(pedro.student.id);
    await expect(commentOnWorkout(ana.viewer, { sessionId: running.id, body: "oi" }, deps)).rejects.toThrow("Treino não encontrado.");
    await expect(commentOnWorkout(ana.viewer, { sessionId: others.id, body: "oi" }, deps)).rejects.toThrow("Treino não encontrado.");
    await expect(commentOnWorkout(coach, { sessionId: others.id, body: "oi" }, deps)).rejects.toThrow("Só o aluno");
    await expect(commentOnWorkout(ana.viewer, { sessionId: others.id, body: " " }, deps)).rejects.toThrow("Escreva a mensagem.");
  });
});
