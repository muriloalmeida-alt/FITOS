// @vitest-environment node
//
// Funcional e CrossFit (feature 1, etapa 3) contra PostgreSQL real: timer
// do bloco com pausas (idempotente), For Time concluído guarda o tempo e
// limite atingido não, só no treino em andamento, e só o próprio.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { blockTimer, finishBlock, listBlockResults } from "./blockResults";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const t = (minutes: number, seconds = 0) => new Date(Date.UTC(2026, 9, 11, 10, minutes, seconds));

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function setup() {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `bloco-${label}-${run}@example.test`, name: "Livre", role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const blocks = [
    { key: "ft", kind: "FOR_TIME", name: null, rounds: 3, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: 900, restSeconds: null },
    { key: "em", kind: "EMOM", name: null, rounds: null, windowSeconds: null, intervals: 10, intervalSeconds: 60, timeCapSeconds: null, restSeconds: null },
  ];
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "WOD", position: 0, blocks } });
  const session = await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id } });
  return { scope: { tenantId: tenant.id, studentId: student.id }, session };
}

describe("blocos no treino ao vivo", () => {
  it("For Time: iniciar, pausar e retomar (repetir não duplica); concluído guarda o tempo sem as pausas", async () => {
    const { scope, session } = await setup();
    await blockTimer(scope, session.id, "ft", "INICIAR", prisma, t(0));
    await blockTimer(scope, session.id, "ft", "INICIAR", prisma, t(1)); // reconexão
    await blockTimer(scope, session.id, "ft", "PAUSAR", prisma, t(3));
    await blockTimer(scope, session.id, "ft", "PAUSAR", prisma, t(3, 30));
    await blockTimer(scope, session.id, "ft", "RETOMAR", prisma, t(4));
    const done = await finishBlock(scope, session.id, "ft", { outcome: "CONCLUIDO", roundsCompleted: 3 }, prisma, t(10));
    expect(done).toMatchObject({ outcome: "CONCLUIDO", roundsCompleted: 3, elapsedSeconds: 540, pausedSeconds: 60 });
    await expect(blockTimer(scope, session.id, "ft", "PAUSAR", prisma, t(11))).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    // Corrigir o resultado não muda o fim nem o tempo.
    expect(await finishBlock(scope, session.id, "ft", { outcome: "CONCLUIDO", roundsCompleted: 3, note: "Escalado" }, prisma, t(20))).toMatchObject({ elapsedSeconds: 540, note: "Escalado" });
  });

  it("limite atingido não vira tempo; encerrar em pausa desconta a pausa; EMOM conta intervalos", async () => {
    const { scope, session } = await setup();
    await blockTimer(scope, session.id, "ft", "INICIAR", prisma, t(0));
    expect(await finishBlock(scope, session.id, "ft", { outcome: "LIMITE_ATINGIDO", roundsCompleted: 2, partialReps: 10 }, prisma, t(15))).toMatchObject({ outcome: "LIMITE_ATINGIDO", elapsedSeconds: null, partialReps: 10 });

    await blockTimer(scope, session.id, "em", "INICIAR", prisma, t(20));
    await blockTimer(scope, session.id, "em", "PAUSAR", prisma, t(25));
    const emom = await finishBlock(scope, session.id, "em", { outcome: "PARCIAL", intervalsCompleted: 5 }, prisma, t(30));
    expect(emom).toMatchObject({ intervalsCompleted: 5, pausedSeconds: 300, elapsedSeconds: null });
    await expect(finishBlock(scope, session.id, "em", { outcome: "LIMITE_ATINGIDO" }, prisma, t(31))).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(finishBlock(scope, session.id, "em", { intervalsCompleted: 11 }, prisma, t(31))).rejects.toMatchObject({ kind: "VALIDACAO" });
    expect((await listBlockResults(scope, session.id, prisma)).map((row) => row.blockKey).sort()).toEqual(["em", "ft"]);
  });

  it("só no treino em andamento, só o próprio e só bloco que existe", async () => {
    const { scope, session } = await setup();
    const other = await setup();
    await expect(blockTimer(other.scope, session.id, "ft", "INICIAR", prisma, t(0))).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(blockTimer(scope, session.id, "nao-existe", "INICIAR", prisma, t(0))).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(blockTimer(scope, session.id, "ft", "PAUSAR", prisma, t(0))).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    await prisma.workoutSession.update({ where: { id: session.id }, data: { status: "CONCLUIDA", endedAt: t(5) } });
    await expect(blockTimer(scope, session.id, "ft", "INICIAR", prisma, t(6))).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });
});
