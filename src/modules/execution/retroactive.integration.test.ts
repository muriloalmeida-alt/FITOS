// @vitest-environment node
//
// Treino retroativo (feature 2) contra PostgreSQL real: vira um treino
// avulso concluído em modo RETROATIVO, com séries e agregados, sem
// duplicar por retry, dentro do prazo e só com exercícios do catálogo.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { getInProgressSessionForStudent } from "./sessions";
import { getLastPerformanceForExercises } from "./sets";
import { getFreeWorkoutQuality, saveFreeWorkout, startOrResumeFreeWorkoutSession } from "./freeWorkout";
import { RETRO_WORKOUT_NAME, recordRetroactiveWorkout } from "./retroactive";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = new Date("2026-10-11T15:00:00Z");
const performedAt = new Date("2026-10-07T21:30:00Z");

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
  const bike = await prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Bike ${label} ${run}`, muscle: "Aeróbico", type: "Aeróbico" } });
  return { scope: { tenantId: tenant.id, studentId: student.id }, leg, bike };
}

const key = () => `retro-${run}-${++counter}`;
const legSets = (exerciseId: string) => ({ exerciseId, sets: [1, 2, 3].map(() => ({ reps: 10, loadKg: 30 })) });

describe("treino retroativo", () => {
  it("registra concluído, com a data da realização, duração declarada e séries; entra no histórico e na última vez", async () => {
    const { scope, leg, bike } = await setup();
    const result = await recordRetroactiveWorkout(
      { ...scope, operationKey: key(), performedAt, durationSeconds: 45 * 60, exercises: [legSets(leg.id), { exerciseId: bike.id, sets: [{ durationSeconds: 900 }] }], now },
      prisma
    );
    expect(result).toMatchObject({ replayed: false, possibleDuplicate: false });

    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: result.sessionId }, include: { workout: true, setResults: true, results: true } });
    expect(session).toMatchObject({ status: "CONCLUIDA", mode: "RETROATIVO", startedAt: performedAt, performedAt, recordedAt: now, declaredDurationSeconds: 2700, activeSeconds: null });
    expect(session.endedAt).toEqual(new Date(performedAt.getTime() + 2700_000));
    expect(session.workout).toMatchObject({ name: RETRO_WORKOUT_NAME, status: "AVULSO" });
    expect(session.setResults).toHaveLength(4);
    expect(session.results.map((row) => row.setsCompleted).sort()).toEqual([1, 3]);
    expect(session.results.every((row) => row.recordedAt.getTime() === performedAt.getTime())).toBe(true);

    const last = await getLastPerformanceForExercises({ ...scope, exerciseIds: [leg.id] }, prisma);
    expect(last.get(leg.id)).toMatchObject({ last: { loadKg: 30, reps: 10, at: performedAt }, bestLoadKg: 30 });
    // Não vira treino em andamento e a avaliação do avulso funciona.
    expect(await getInProgressSessionForStudent(scope, prisma)).toBeNull();
    expect((await getFreeWorkoutQuality({ ...scope, sessionId: result.sessionId, now }, prisma)).worked).toEqual([{ area: "Quadríceps", sets: 3 }]);
    // E pode ir para "Meus treinos" como o avulso.
    expect((await saveFreeWorkout({ ...scope, sessionId: result.sessionId, name: "Pernas" }, prisma)).status).toBe("ATIVO");
  });

  it("mesma chave (retry ou clique duplo em paralelo) não duplica; outro horário próximo só avisa", async () => {
    const { scope, leg } = await setup();
    const operationKey = key();
    const send = () => recordRetroactiveWorkout({ ...scope, operationKey, performedAt, durationSeconds: 1800, exercises: [legSets(leg.id)], now }, prisma);
    const [a, b] = await Promise.all([send(), send()]);
    expect(a.sessionId).toBe(b.sessionId);
    expect((await send()).replayed).toBe(true);
    expect(await prisma.workoutSession.count({ where: { ...scope, mode: "RETROATIVO" } })).toBe(1);

    const near = await recordRetroactiveWorkout({ ...scope, operationKey: key(), performedAt: new Date(performedAt.getTime() + 10 * 60_000), durationSeconds: 1800, exercises: [legSets(leg.id)], now }, prisma);
    expect(near.possibleDuplicate).toBe(true);
  });

  it("recusa fora do prazo, data futura, sem duração, sem séries, tipo errado e exercício fora do catálogo", async () => {
    const { scope, leg, bike } = await setup();
    const other = await setup();
    const own = await prisma.exercise.create({ data: { tenantId: other.scope.tenantId, origin: "PERSONAL", name: `Próprio ${run}` } });
    const base = { ...scope, durationSeconds: 1800, exercises: [legSets(leg.id)], now };
    const attempts = [
      { ...base, operationKey: key(), performedAt: new Date("2026-10-03T12:00:00Z") },
      { ...base, operationKey: key(), performedAt: new Date("2026-10-11T16:00:00Z") },
      { ...base, operationKey: key(), performedAt, durationSeconds: 0 },
      { ...base, operationKey: key(), performedAt, exercises: [] },
      { ...base, operationKey: key(), performedAt, exercises: [{ exerciseId: leg.id, sets: [] }] },
      { ...base, operationKey: key(), performedAt, exercises: [{ exerciseId: leg.id, sets: [{ loadKg: 30 }] }] },
      { ...base, operationKey: key(), performedAt, exercises: [{ exerciseId: bike.id, sets: [{ reps: 10 }] }] },
      { ...base, operationKey: key(), performedAt, exercises: [legSets(leg.id), legSets(leg.id)] },
      { ...base, operationKey: key(), performedAt, exercises: [legSets(own.id)] },
      { ...base, operationKey: "x", performedAt },
    ];
    for (const attempt of attempts) await expect(recordRetroactiveWorkout(attempt, prisma)).rejects.toMatchObject({ name: "SessionError" });
    expect(await prisma.workoutSession.count({ where: scope })).toBe(0);
  });

  it("não mexe no treino ao vivo em andamento; chave de outra pessoa é recusada", async () => {
    const { scope, leg } = await setup();
    const other = await setup();
    const live = await startOrResumeFreeWorkoutSession(scope, prisma);
    const operationKey = key();
    await recordRetroactiveWorkout({ ...scope, operationKey, performedAt, durationSeconds: 1800, exercises: [legSets(leg.id)], now }, prisma);
    expect((await getInProgressSessionForStudent(scope, prisma))?.id).toBe(live.id);
    await expect(recordRetroactiveWorkout({ ...other.scope, operationKey, performedAt, durationSeconds: 1800, exercises: [legSets(other.leg.id)], now }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});
