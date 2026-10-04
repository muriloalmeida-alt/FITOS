// @vitest-environment node
//
// FIT-153 (EPIC-20, ADR-015): registro por série (BK-11), última vez e
// recordes por série (BK-12), esforço (BK-13) e tempo ativo (BK-14).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { completeWorkoutSession, rateWorkoutSession } from "./sessions";
import { getLastPerformanceForExercises, getSessionSummary, recordWorkoutSet, removeWorkoutSet } from "./sets";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: "Joana", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}` } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `aluno-${label}-${run}@example.test`, displayName: "Pedro" } });
  const supino = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino ${label} ${run}`, origin: "PERSONAL" } });
  const prancha = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Prancha ${label} ${run}`, origin: "PERSONAL" } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
  const supinoItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: supino.id, position: 0, sets: 3, reps: 10, load: "40 kg" } });
  const pranchaItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: prancha.id, position: 1, sets: 2, durationSeconds: 30 } });
  const session = (startedAt = new Date(Date.now() - 50 * 60_000)) => prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, startedAt } });
  return { tenant, student, supino, supinoItem, pranchaItem, session };
}

describe("registro por série (BK-11, BK-12)", () => {
  it("grava cada série, mantém o agregado com a maior carga e marca recorde sobre a sessão anterior", async () => {
    const f = await setup("serie");
    const base = { tenantId: f.tenant.id, studentId: f.student.id };

    const first = await f.session(new Date(Date.now() - 3 * 86_400_000));
    await recordWorkoutSet({ ...base, sessionId: first.id, workoutExerciseId: f.supinoItem.id, setNumber: 1, reps: 10, durationSeconds: null, loadKg: 40 }, prisma);
    const firstAgain = await recordWorkoutSet({ ...base, sessionId: first.id, workoutExerciseId: f.supinoItem.id, setNumber: 2, reps: 8, durationSeconds: null, loadKg: 42.5 }, prisma);
    expect(firstAgain.personalRecord).toBe(false); // sem histórico, não é recorde
    expect(firstAgain.aggregate).toMatchObject({ setsCompleted: 2, repsCompleted: 8, loadUsed: "42,5 kg" });
    await completeWorkoutSession({ ...base, sessionId: first.id, activeSeconds: 40 * 60 }, prisma);

    const second = await f.session();
    const last = await getLastPerformanceForExercises({ ...base, exerciseIds: [f.supino.id], excludeSessionId: second.id }, prisma);
    expect(last.get(f.supino.id)).toMatchObject({ last: { loadKg: 42.5, reps: 8 }, bestLoadKg: 42.5 });

    const same = await recordWorkoutSet({ ...base, sessionId: second.id, workoutExerciseId: f.supinoItem.id, setNumber: 1, reps: 10, durationSeconds: null, loadKg: 42.5 }, prisma);
    expect(same.personalRecord).toBe(false);
    const record = await recordWorkoutSet({ ...base, sessionId: second.id, workoutExerciseId: f.supinoItem.id, setNumber: 2, reps: 6, durationSeconds: null, loadKg: 45 }, prisma);
    expect(record.personalRecord).toBe(true);
    // Reenviar a mesma série substitui, nunca duplica.
    await recordWorkoutSet({ ...base, sessionId: second.id, workoutExerciseId: f.supinoItem.id, setNumber: 2, reps: 7, durationSeconds: null, loadKg: 45 }, prisma);
    await recordWorkoutSet({ ...base, sessionId: second.id, workoutExerciseId: f.pranchaItem.id, setNumber: 1, reps: null, durationSeconds: 30, loadKg: null }, prisma);
    expect(await prisma.workoutSetResult.count({ where: { workoutSessionId: second.id } })).toBe(3);

    const undone = await removeWorkoutSet({ ...base, sessionId: second.id, workoutExerciseId: f.pranchaItem.id, setNumber: 1 }, prisma);
    expect(undone).toBeNull();
    expect(await prisma.workoutSessionResult.count({ where: { workoutSessionId: second.id, workoutExerciseId: f.pranchaItem.id } })).toBe(0);

    const done = await completeWorkoutSession({ ...base, sessionId: second.id, activeSeconds: 999_999 }, prisma);
    expect(done.activeSeconds).toBeLessThanOrEqual(50 * 60 + 5); // nunca passa do relógio
    const summary = await getSessionSummary({ ...base, sessionId: second.id }, prisma);
    expect(summary).toMatchObject({ sets: 2, volumeKg: 42.5 * 10 + 45 * 7, perceivedEffort: null });
    expect(summary.records).toEqual([{ exerciseName: f.supino.name, loadKg: 45 }]);

    await rateWorkoutSession({ ...base, sessionId: second.id, perceivedEffort: 4 }, prisma);
    expect((await getSessionSummary({ ...base, sessionId: second.id }, prisma)).perceivedEffort).toBe(4);
  });

  it("valida a série e só aceita item da própria sessão em andamento", async () => {
    const f = await setup("valida");
    const other = await setup("outro");
    const base = { tenantId: f.tenant.id, studentId: f.student.id };
    const session = await f.session();
    await expect(recordWorkoutSet({ ...base, sessionId: session.id, workoutExerciseId: f.supinoItem.id, setNumber: 1, reps: null, durationSeconds: null, loadKg: 10 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(recordWorkoutSet({ ...base, sessionId: session.id, workoutExerciseId: f.supinoItem.id, setNumber: 0, reps: 10, durationSeconds: null, loadKg: 10 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(recordWorkoutSet({ ...base, sessionId: session.id, workoutExerciseId: other.supinoItem.id, setNumber: 1, reps: 10, durationSeconds: null, loadKg: 10 }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(rateWorkoutSession({ ...base, sessionId: session.id, perceivedEffort: 3 }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    await expect(rateWorkoutSession({ ...base, sessionId: session.id, perceivedEffort: 6 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await completeWorkoutSession({ ...base, sessionId: session.id }, prisma);
    await expect(recordWorkoutSet({ ...base, sessionId: session.id, workoutExerciseId: f.supinoItem.id, setNumber: 1, reps: 10, durationSeconds: null, loadKg: 10 }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });
});
