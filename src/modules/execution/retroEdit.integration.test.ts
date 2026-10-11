// @vitest-environment node
//
// Treino retroativo, parte 2 (feature 2) contra PostgreSQL real: editar
// dentro do prazo guarda a versão anterior e recalcula os pontos pela
// diferença, uma vez; excluir deixa a trilha; aluno só exclui o que
// registrou; período consolidado não muda depois.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { deleteFinishedWorkoutSession } from "./sessions";
import { recordRetroactiveWorkout, retroEditable, updateRetroactiveWorkout } from "./retroactive";
import { startOrResumeFreeWorkoutSession } from "./freeWorkout";
import { getSessionPoints } from "@/modules/gamification/sessionScoring";
import { getAchievements } from "@/modules/gamification/achievements";
import { getFinishedSessionForSelf } from "./finishedSession";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = new Date("2026-10-11T15:00:00Z");
const performedAt = new Date("2026-10-09T21:30:00Z");

beforeEach(() => vi.stubEnv("FEATURE_GAMIFICACAO", "on"));
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSetResult.deleteMany({ where: tenant });
  await prisma.workoutSessionResult.deleteMany({ where: tenant });
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workoutExercise.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function setup() {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const leg = await prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Leg Press ${label} ${run}`, muscle: "Quadríceps", type: "Máquina" } });
  return { scope: { tenantId: tenant.id, studentId: student.id }, actor: { actorUserId: owner.id }, leg };
}

const key = () => `retro-${run}-${++counter}`;
const legSets = (exerciseId: string, loadKg: number) => ({ exerciseId, sets: [1, 2, 3].map(() => ({ reps: 10, loadKg })) });

async function record(scope: { tenantId: string; studentId: string }, exerciseId: string, at = performedAt, at_now = now) {
  const { sessionId } = await recordRetroactiveWorkout({ ...scope, operationKey: key(), performedAt: at, durationSeconds: 45 * 60, exercises: [legSets(exerciseId, 30)], now: at_now }, prisma);
  return sessionId;
}

/// Pontos liberados (a foto já chegou) num instante conhecido.
async function release(sessionId: string, releasedAt: Date) {
  await prisma.sessionScore.update({ where: { sessionId }, data: { status: "LIBERADO", releasedAt } });
}

describe("treino retroativo: edição e exclusão", () => {
  it("edita dentro do prazo: guarda a versão anterior e recalcula pela diferença, uma vez", async () => {
    const { scope, actor, leg } = await setup();
    const sessionId = await record(scope, leg.id);
    await release(sessionId, now);
    expect(await getSessionPoints(scope, sessionId, prisma, now)).toMatchObject({ totalTenths: 100, status: "LIBERADO" });

    const newDate = new Date("2026-10-10T11:00:00Z");
    await updateRetroactiveWorkout({ ...scope, ...actor, sessionId, performedAt: newDate, durationSeconds: 50 * 60, exercises: [legSets(leg.id, 33)], now }, prisma);

    // 990 kg sobre a referência de 900 kg: 11 pontos, ainda liberados.
    const score = await prisma.sessionScore.findUniqueOrThrow({ where: { sessionId }, include: { events: { orderBy: { createdAt: "asc" } } } });
    expect(score).toMatchObject({ totalTenths: 110, status: "LIBERADO", performedAt: newDate });
    expect(score.events.map((event) => event.kind)).toEqual(["CALCULADO", "RECALCULADO"]);
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, include: { setResults: true } });
    expect(session).toMatchObject({ performedAt: newDate, declaredDurationSeconds: 50 * 60, mode: "RETROATIVO" });
    expect(session.setResults.map((set) => set.loadGrams)).toEqual([33000, 33000, 33000]);

    const [revision] = await prisma.workoutSessionRevision.findMany({ where: { sessionId } });
    expect(revision).toMatchObject({
      action: "EDITADO",
      actorUserId: actor.actorUserId,
      pointsTenthsBefore: 100,
      pointsStatusBefore: "LIBERADO",
      pointsTenthsAfter: 110,
      snapshot: { performedAt: performedAt.toISOString(), declaredDurationSeconds: 45 * 60, exercises: [{ exerciseId: leg.id, sets: [{ reps: 10, loadGrams: 30000 }, { reps: 10, loadGrams: 30000 }, { reps: 10, loadGrams: 30000 }] }] },
    });

    // Mesma edição de novo: nada a recalcular.
    await updateRetroactiveWorkout({ ...scope, ...actor, sessionId, performedAt: newDate, durationSeconds: 50 * 60, exercises: [legSets(leg.id, 33)], now }, prisma);
    expect(await prisma.scoreEvent.count({ where: { sessionScoreId: score.id } })).toBe(2);
  });

  it("não edita fora do prazo, treino ao vivo, de outra pessoa ou para o futuro", async () => {
    const { scope, actor, leg } = await setup();
    const other = await setup();
    const sessionId = await record(scope, leg.id);
    const body = { performedAt, durationSeconds: 1800, exercises: [legSets(leg.id, 30)] };
    const late = new Date(performedAt.getTime() + 8 * 86_400_000);
    expect(retroEditable({ mode: "RETROATIVO", status: "CONCLUIDA", performedAt, startedAt: performedAt }, late)).toBe(false);
    await expect(updateRetroactiveWorkout({ ...scope, ...actor, sessionId, ...body, now: late }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    await expect(updateRetroactiveWorkout({ ...other.scope, ...other.actor, sessionId, ...body, now }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(updateRetroactiveWorkout({ ...scope, ...actor, sessionId, ...body, performedAt: new Date(now.getTime() + 86_400_000), now }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    const live = await startOrResumeFreeWorkoutSession(scope, prisma);
    await expect(updateRetroactiveWorkout({ ...scope, ...actor, sessionId: live.id, ...body, now }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    expect(await prisma.workoutSessionRevision.count({ where: { sessionId } })).toBe(0);

    // Detalhe: só o próprio, com as séries e se ainda dá para editar.
    expect(await getFinishedSessionForSelf(scope, sessionId, prisma, now)).toMatchObject({ mode: "RETROATIVO", durationSeconds: 2700, editable: true, exercises: [{ exerciseId: leg.id, sets: [{ reps: 10, loadKg: 30 }, { reps: 10, loadKg: 30 }, { reps: 10, loadKg: 30 }] }] });
    expect(await getFinishedSessionForSelf(scope, sessionId, prisma, late)).toMatchObject({ editable: false });
    expect(await getFinishedSessionForSelf(other.scope, sessionId, prisma, now)).toBeNull();
  });

  it("exclui com trilha e estorno; aluno só exclui o que registrou", async () => {
    const { scope, actor, leg } = await setup();
    const sessionId = await record(scope, leg.id);
    await release(sessionId, now);
    const live = await prisma.workoutSession.create({ data: { ...scope, workoutId: (await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).workoutId, status: "CONCLUIDA", endedAt: now } });
    await expect(deleteFinishedWorkoutSession({ ...scope, ...actor, sessionId: live.id, onlyRetroactive: true }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });

    await deleteFinishedWorkoutSession({ ...scope, ...actor, sessionId, onlyRetroactive: true }, prisma);
    expect(await prisma.sessionScore.findUnique({ where: { sessionId } })).toBeNull();
    expect(await prisma.workoutSessionRevision.findFirst({ where: { sessionId } })).toMatchObject({ action: "EXCLUIDO", pointsTenthsBefore: 100, pointsStatusBefore: "LIBERADO", snapshot: { mode: "RETROATIVO" } });
  });

  it("semana consolidada fica congelada: registro tardio e exclusão não mudam o resultado", async () => {
    const { scope, actor, leg } = await setup();
    // Semana de 28/09 (segunda) a 04/10; consolida 24 h depois do fim.
    const wednesday = new Date("2026-09-30T12:00:00Z");
    const first = await record(scope, leg.id, wednesday, new Date("2026-10-01T12:00:00Z"));
    await release(first, new Date("2026-10-01T12:00:00Z"));
    const afterClose = new Date("2026-10-07T12:00:00Z");
    const week = async () => (await getAchievements(scope, prisma, afterClose)).weeks.find((summary) => summary.key === "2026-09-28");
    expect(await week()).toMatchObject({ pointsTenths: 100 });

    // Registrado depois da consolidação: fica no histórico, fora da semana encerrada.
    const late = await record(scope, leg.id, new Date("2026-10-03T12:00:00Z"), afterClose);
    await release(late, afterClose);
    expect((await getSessionPoints(scope, late, prisma, afterClose))?.countsIn).toEqual({ week: false, month: true });
    expect(await week()).toMatchObject({ pointsTenths: 100 });

    // Excluir depois da consolidação não tira a medalha já consolidada.
    await deleteFinishedWorkoutSession({ ...scope, ...actor, sessionId: first }, prisma);
    expect(await week()).toMatchObject({ pointsTenths: 100 });
  });
});
