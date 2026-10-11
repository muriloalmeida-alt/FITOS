// @vitest-environment node
//
// FitOS Desafios (feature 3) contra PostgreSQL real: pontuação calculada
// das séries, referência congelada, foto libera, sem foto pendente,
// estorno ao tirar a última foto, idempotência e nada sem a flag.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { completeWorkoutSession, startOrResumeIndividualWorkoutSession } from "@/modules/execution/sessions";
import { recordWorkoutSet } from "@/modules/execution/sets";
import { addSessionEvidence, deleteSessionEvidence } from "@/modules/execution/evidence";
import { blockTimer, finishBlock } from "@/modules/execution/blockResults";
import { recordRetroactiveWorkout } from "@/modules/execution/retroactive";
import { getSessionPoints, previewPoints, releaseOnEvidence, scoreSession } from "./sessionScoring";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
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
/// Livre com um treino de programa: leg press 3 × 10 × 30 kg (900 kg),
/// flexão 3 × 12 sem carga (36 repetições) e bicicleta 30 min.
async function setup() {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const [leg, push, bike] = await Promise.all([
    prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Leg ${label} ${run}`, type: "Máquina" } }),
    prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Flexão ${label} ${run}`, type: "Peso corporal" } }),
    prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Bike ${label} ${run}`, type: "Aeróbico" } }),
  ]);
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Plano", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
  const items = await Promise.all([
    prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: leg.id, position: 0, sets: 3, reps: 10, load: "30 kg" } }),
    prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: push.id, position: 1, sets: 3, reps: 12 } }),
    prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: bike.id, position: 2, durationSeconds: 1800, intensity: "MODERADO" } }),
  ]);
  const scope = { tenantId: tenant.id, studentId: student.id };
  return { scope, userId: owner.id, workout, items, leg, push, bike };
}

async function train(ctx: Awaited<ReturnType<typeof setup>>, legKg: number[], pushReps: number[], bikeSeconds: number | null) {
  const session = await startOrResumeIndividualWorkoutSession({ ...ctx.scope, workoutId: ctx.workout.id }, prisma);
  const [leg, push, bike] = ctx.items;
  for (const [index, kg] of legKg.entries()) await recordWorkoutSet({ ...ctx.scope, sessionId: session.id, workoutExerciseId: leg!.id, setNumber: index + 1, reps: 10, durationSeconds: null, loadKg: kg }, prisma);
  for (const [index, reps] of pushReps.entries()) await recordWorkoutSet({ ...ctx.scope, sessionId: session.id, workoutExerciseId: push!.id, setNumber: index + 1, reps, durationSeconds: null, loadKg: null }, prisma);
  if (bikeSeconds) await recordWorkoutSet({ ...ctx.scope, sessionId: session.id, workoutExerciseId: bike!.id, setNumber: 1, reps: null, durationSeconds: bikeSeconds, loadKg: null }, prisma);
  return completeWorkoutSession({ ...ctx.scope, sessionId: session.id, activeSeconds: 600 }, prisma);
}

const jpeg = (seed: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, seed]);

describe("pontuação do treino", () => {
  it("com a flag: calcula pelas séries (900 kg = 10, 36 reps = 10, 40 min = 11), pendente sem foto e liberada com foto", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "on");
    const ctx = await setup();
    const session = await train(ctx, [30, 30, 30], [12, 12, 12], 40 * 60);
    const points = await getSessionPoints(ctx.scope, session.id, prisma);
    expect(points).toMatchObject({ totalTenths: 310, plannedItems: 3, balancedTenths: 103, status: "PENDENTE_FOTO" });
    expect(points!.items.map((item) => [item.kind, item.source, item.pointsTenths])).toEqual([
      ["VOLUME", "PRESCRICAO", 100],
      ["REPETICOES", "PRESCRICAO", 100],
      ["TEMPO", "PRESCRICAO", 110],
    ]);

    await addSessionEvidence({ ...ctx.scope, userId: ctx.userId, sessionId: session.id, bytes: jpeg(1), width: 10, height: 10 }, prisma);
    expect((await getSessionPoints(ctx.scope, session.id, prisma))!.status).toBe("LIBERADO");
    // Tirar a última foto estorna para pendente, com trilha.
    const [evidence] = await prisma.workoutEvidencePhoto.findMany({ where: { sessionId: session.id } });
    await deleteSessionEvidence(ctx.scope, evidence!.id, prisma);
    expect((await getSessionPoints(ctx.scope, session.id, prisma))!.status).toBe("PENDENTE_FOTO");
    const events = await prisma.scoreEvent.findMany({ where: { score: { sessionId: session.id } }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => event.kind)).toEqual(["CALCULADO", "LIBERADO", "ESTORNADO"]);
  });

  it("referência congelada: o segundo treino compara com a primeira, mesmo mudando a prescrição; recalcular é idempotente", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "on");
    const ctx = await setup();
    await train(ctx, [30, 30, 30], [12, 12, 12], 30 * 60);
    await prisma.workoutExercise.update({ where: { id: ctx.items[0]!.id }, data: { load: "50 kg" } });
    // Cargas diferentes série a série: 300 + 330 + 360 = 990 kg → 11.
    const second = await train(ctx, [30, 33, 36], [10, 10], null);
    const points = (await getSessionPoints(ctx.scope, second.id, prisma))!;
    expect(points.items.map((item) => item.pointsTenths)).toEqual([110, 56, 0]);
    expect(points.totalTenths).toBe(166);
    expect(points.balancedTenths).toBe(55);

    const again = await scoreSession(second.id, prisma);
    expect(again!.id).toBeDefined();
    expect(await prisma.sessionScore.count({ where: { sessionId: second.id } })).toBe(1);
    expect(await prisma.scoringReference.count({ where: { studentId: ctx.scope.studentId } })).toBe(3);
  });

  it("foto fora do prazo não libera; sem a flag nada é calculado", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "on");
    const ctx = await setup();
    const session = await train(ctx, [30, 30, 30], [12, 12, 12], 1800);
    const late = new Date(Date.now() + 25 * 3_600_000);
    expect(await releaseOnEvidence(session.id, prisma, late)).toBe("PENDENTE_FOTO");

    vi.stubEnv("FEATURE_GAMIFICACAO", "off");
    const other = await setup();
    const unscored = await train(other, [30, 30, 30], [12], null);
    expect(await getSessionPoints(other.scope, unscored.id, prisma)).toBeNull();
  });

  it("regra 2: isometria por tempo (1 ponto a cada 30 s) e bloco ao vivo pelos minutos medidos, sem pontuar de novo os exercícios do bloco", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "on");
    const ctx = await setup();
    const plank = await prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Prancha ${run}`, type: "Peso corporal" } });
    const plankItem = await prisma.workoutExercise.create({ data: { tenantId: ctx.scope.tenantId, workoutId: ctx.workout.id, exerciseId: plank.id, position: 3, sets: 3, durationSeconds: 60 } });
    // Flexão dentro de um AMRAP de 12 min.
    await prisma.workout.update({ where: { id: ctx.workout.id }, data: { blocks: [{ key: "wod", kind: "AMRAP", name: null, rounds: null, windowSeconds: 720, intervals: null, intervalSeconds: null, timeCapSeconds: null, restSeconds: null }] } });
    await prisma.workoutExercise.update({ where: { id: ctx.items[1]!.id }, data: { blockKey: "wod" } });

    const session = await startOrResumeIndividualWorkoutSession({ ...ctx.scope, workoutId: ctx.workout.id }, prisma);
    for (const set of [1, 2, 3]) await recordWorkoutSet({ ...ctx.scope, sessionId: session.id, workoutExerciseId: plankItem.id, setNumber: set, reps: null, durationSeconds: 60, loadKg: null }, prisma);
    await recordWorkoutSet({ ...ctx.scope, sessionId: session.id, workoutExerciseId: ctx.items[1]!.id, setNumber: 1, reps: 50, durationSeconds: null, loadKg: null }, prisma);
    const start = new Date("2026-10-11T10:00:00Z");
    await blockTimer(ctx.scope, session.id, "wod", "INICIAR", prisma, start);
    await finishBlock(ctx.scope, session.id, "wod", { outcome: "PARCIAL", roundsCompleted: 6, partialReps: 4 }, prisma, new Date(start.getTime() + 720_000));
    await completeWorkoutSession({ ...ctx.scope, sessionId: session.id, activeSeconds: 1500 }, prisma);

    const points = await getSessionPoints(ctx.scope, session.id, prisma);
    const byKind = Object.fromEntries(points!.items.map((item) => [item.kind === "BLOCO" || item.kind === "ISOMETRIA" ? item.kind : item.exerciseId, item.pointsTenths]));
    expect(byKind).toMatchObject({ ISOMETRIA: 60, BLOCO: 120 });
    // A flexão (no bloco) não aparece como item próprio.
    expect(points!.items.some((item) => item.exerciseId === ctx.push.id)).toBe(false);
  });

  it("regra 2: retroativo com bloco pontua pelos minutos declarados, e a prévia bate", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "on");
    const ctx = await setup();
    const now = new Date();
    const forTime = { key: "ft", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 };
    const result = await recordRetroactiveWorkout(
      { ...ctx.scope, operationKey: `pts-${run}-${++counter}`, performedAt: new Date(now.getTime() - 86_400_000), durationSeconds: 1800, now, exercises: [{ exerciseId: ctx.push.id, blockKey: "ft", sets: [] }], blocks: [{ block: forTime, result: { outcome: "CONCLUIDO", elapsedSeconds: 580 } }] },
      prisma
    );
    const points = await getSessionPoints(ctx.scope, result.sessionId, prisma);
    expect(points).toMatchObject({ totalTenths: 96, plannedItems: 1 });
    expect(points!.items[0]).toMatchObject({ exerciseId: "bloco:ft", kind: "BLOCO", done: 580 });

    const preview = await previewPoints(ctx.scope, [{ exerciseId: ctx.push.id, blockKey: "ft", sets: [] }], prisma, [
      { block: { key: "ft", kind: "FOR_TIME", name: null, rounds: 3, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: 900, restSeconds: null }, result: { outcome: "CONCLUIDO", roundsCompleted: null, partialReps: null, intervalsCompleted: null, elapsedSeconds: 580 } },
    ]);
    expect(preview.totalTenths).toBe(96);
  });
});
