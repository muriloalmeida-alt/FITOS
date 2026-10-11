// @vitest-environment node
//
// Funcional e CrossFit (feature 1, etapa 2): blocos do treino e metas por
// métrica contra PostgreSQL real. Itens entram e saem de blocos, bloco
// removido devolve os itens às séries, e cópias (duplicar, programa do
// aluno) levam blocos e metas.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { readBlocks } from "@/shared/lib/workoutBlocks";
import { addWorkoutExercise, addWorkoutToPlan, assignTrainingPlanToStudents, createTrainingPlan, createWorkout, duplicateWorkout, listWorkoutExercisesForWorkout, updateWorkout, updateWorkoutExercise } from "./workouts";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function globalExercise(label: string, imageUrl: string | null = null) {
  return prisma.exercise.create({ data: { tenantId: null, origin: "FITOS_CURATED", name: `Global ${label} ${run}`, imageUrl } });
}

describe("blocos do treino", () => {
  it("monta circuito e AMRAP, põe itens nos blocos com metas e remove bloco devolvendo os itens", async () => {
    const { tenant } = await createTenant("blocos");
    const squat = await globalExercise("goblet");
    const carry = await globalExercise("farmer");
    const workout = await createWorkout({ tenantId: tenant.id, name: `WOD ${run}` }, prisma);
    const a = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: squat.id, sets: 1, reps: 10 }, prisma);
    const b = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: carry.id, sets: 1 }, prisma);

    await updateWorkout({ tenantId: tenant.id, workoutId: workout.id, blocks: [{ key: "c1", kind: "CIRCUITO", rounds: 3 }, { key: "a1", kind: "AMRAP", windowSeconds: 600, name: "WOD" }] }, prisma);
    await updateWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: a.id, blockKey: "c1" }, prisma);
    await updateWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: b.id, blockKey: "c1", targetDistanceMeters: 20, load: "2 × 24 kg" }, prisma);
    await expect(updateWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: a.id, blockKey: "nao-existe" }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(updateWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: a.id, targetCalories: 0 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(updateWorkout({ tenantId: tenant.id, workoutId: workout.id, blocks: [{ key: "x", kind: "AMRAP" }] }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });

    let items = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(items.map((item) => [item.blockKey, item.targetDistanceMeters])).toEqual([["c1", null], ["c1", 20]]);

    // Duplicar leva blocos, chaves e metas.
    const copy = await duplicateWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(readBlocks(copy.blocks).map((block) => block.key)).toEqual(["c1", "a1"]);
    const copyItems = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: copy.id }, prisma);
    expect(copyItems.map((item) => [item.blockKey, item.targetDistanceMeters, item.load])).toEqual([["c1", null, null], ["c1", 20, "2 × 24 kg"]]);

    // Tirar o circuito devolve os itens às séries tradicionais.
    await updateWorkout({ tenantId: tenant.id, workoutId: workout.id, blocks: [{ key: "a1", kind: "AMRAP", windowSeconds: 600 }] }, prisma);
    items = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(items.map((item) => item.blockKey)).toEqual([null, null]);
  });

  it("o programa atribuído ao aluno leva os blocos (cópia imutável)", async () => {
    const { owner, tenant } = await createTenant("blocos-aluno");
    const ex = await globalExercise("wall-ball");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `For Time ${run}` }, prisma);
    const item = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: ex.id, sets: 1, reps: 30 }, prisma);
    await updateWorkout({ tenantId: tenant.id, workoutId: workout.id, blocks: [{ key: "ft", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 }] }, prisma);
    await updateWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: item.id, blockKey: "ft" }, prisma);
    await addWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `bl-${run}@example.test`, displayName: "Bia" } });
    const [assignment] = await assignTrainingPlanToStudents({ tenantId: tenant.id, actorUserId: owner.id, trainingPlanId: plan.id, studentIds: [student.id] }, prisma);
    const copied = await prisma.workout.findFirstOrThrow({ where: { trainingPlanId: assignment!.trainingPlanId }, include: { workoutExercises: true } });
    expect(readBlocks(copied.blocks)).toEqual([expect.objectContaining({ key: "ft", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 })]);
    expect(copied.workoutExercises.map((row) => row.blockKey)).toEqual(["ft"]);
  });
});
