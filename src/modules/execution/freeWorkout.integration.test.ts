// @vitest-environment node
//
// Treino avulso do FitOS Livre contra PostgreSQL real: começa vazio, os
// exercícios entram durante a execução, não aparece nas listas de treinos
// e só vira histórico (ou treino salvo) com séries feitas.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createWorkout, addWorkoutExercise, listWorkoutSummariesForTenant } from "@/modules/workouts/workouts";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { abandonWorkoutSession, completeWorkoutSession, getInProgressSessionForStudent, SessionError, startOrResumeIndividualWorkoutSession } from "./sessions";
import { recordWorkoutSet } from "./sets";
import { addExercisesToFreeSession, saveFreeWorkout, startOrResumeFreeWorkoutSession } from "./freeWorkout";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const supino = await prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Supino ${label} ${run}` } });
  const bike = await prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Bike ${label} ${run}`, type: "Aeróbico" } });
  return { scope: { tenantId: tenant.id, studentId: student.id }, supino, bike };
}

describe("treino avulso (FitOS Livre)", () => {
  it("começa vazio, recebe exercícios durante o treino e fica fora das listas", async () => {
    const { scope, supino, bike } = await setup("fluxo");
    const session = await startOrResumeFreeWorkoutSession(scope, prisma);
    expect(session.workout.status).toBe("AVULSO");
    expect(session.workout.workoutExercises).toHaveLength(0);
    expect((await startOrResumeFreeWorkoutSession(scope, prisma)).id).toBe(session.id);

    const items = await addExercisesToFreeSession({ ...scope, sessionId: session.id, exerciseIds: [supino.id, bike.id] }, prisma);
    expect(items.map((item) => item.exercise.name)).toEqual([supino.name, bike.name]);
    expect(items[0]).toMatchObject({ sets: 3, reps: 12, intensity: null });
    expect(items[1]).toMatchObject({ sets: null, intensity: "MODERADO" });

    await recordWorkoutSet({ ...scope, sessionId: session.id, workoutExerciseId: items[0]!.id, setNumber: 1, reps: 10, durationSeconds: null, loadKg: 40, performedExerciseId: null }, prisma);
    await recordWorkoutSet({ ...scope, sessionId: session.id, workoutExerciseId: items[0]!.id, setNumber: 2, reps: 8, durationSeconds: null, loadKg: 40, performedExerciseId: null }, prisma);
    const done = await completeWorkoutSession({ ...scope, sessionId: session.id, activeSeconds: 600 }, prisma);
    expect(done.status).toBe("CONCLUIDA");
    expect(await listWorkoutSummariesForTenant({ tenantId: scope.tenantId }, prisma)).toHaveLength(0);
    expect(await listWorkoutSummariesForTenant({ tenantId: scope.tenantId, status: "ARQUIVADO" }, prisma)).toHaveLength(0);

    const saved = await saveFreeWorkout({ ...scope, sessionId: session.id, name: "  Peito rápido " }, prisma);
    expect(saved).toMatchObject({ status: "ATIVO", name: "Peito rápido" });
    const kept = await prisma.workoutExercise.findMany({ where: { workoutId: saved.id } });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ exerciseId: supino.id, sets: 2, reps: 10 });
    expect((await listWorkoutSummariesForTenant({ tenantId: scope.tenantId }, prisma)).map((workout) => workout.name)).toEqual(["Peito rápido"]);
    await expect(saveFreeWorkout({ ...scope, sessionId: session.id }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });

  it("não conclui sem série; sair sem série apaga a sessão e o treino", async () => {
    const { scope, supino } = await setup("vazio");
    const session = await startOrResumeFreeWorkoutSession(scope, prisma);
    await addExercisesToFreeSession({ ...scope, sessionId: session.id, exerciseIds: [supino.id] }, prisma);
    await expect(completeWorkoutSession({ ...scope, sessionId: session.id }, prisma)).rejects.toBeInstanceOf(SessionError);

    await abandonWorkoutSession({ ...scope, sessionId: session.id }, prisma);
    expect(await prisma.workoutSession.findUnique({ where: { id: session.id } })).toBeNull();
    expect(await prisma.workout.findUnique({ where: { id: session.workoutId } })).toBeNull();
  });

  it("só inclui exercício no treino avulso; começar outro treino descarta o avulso vazio", async () => {
    const { scope, supino } = await setup("outro");
    const workout = await createWorkout({ tenantId: scope.tenantId, name: `Treino A ${run}` }, prisma);
    await addWorkoutExercise({ tenantId: scope.tenantId, workoutId: workout.id, exerciseId: supino.id, sets: 3, reps: 10 }, prisma);
    const planned = await startOrResumeIndividualWorkoutSession({ ...scope, workoutId: workout.id }, prisma);
    await expect(addExercisesToFreeSession({ ...scope, sessionId: planned.id, exerciseIds: [supino.id] }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });

    const free = await startOrResumeFreeWorkoutSession(scope, prisma);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: planned.id } })).status).toBe("ABANDONADA");

    const again = await startOrResumeIndividualWorkoutSession({ ...scope, workoutId: workout.id }, prisma);
    expect((await getInProgressSessionForStudent(scope, prisma))?.id).toBe(again.id);
    expect(await prisma.workout.findUnique({ where: { id: free.workoutId } })).toBeNull();
  });
});
