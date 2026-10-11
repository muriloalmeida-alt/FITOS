// @vitest-environment node
//
// FIT-146 (EPIC-19): construção de treino sem formulário — BK-01 (lote de
// exercícios com prescrição padrão), BK-03 (atribuição em lote), resumos
// e "colocar treino num programa" (move de Meus modelos, copia de outro
// programa). PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  addWorkoutExercise,
  addWorkoutExercisesBatch,
  addWorkoutToPlan,
  archiveWorkout,
  assignTrainingPlanToStudents,
  createTrainingPlan,
  createWorkout,
  DEFAULT_PRESCRIPTION,
  listAssignableStudents,
  listTrainingPlanSummariesForTenant,
  listWorkoutExercisesForWorkout,
  listWorkoutSummariesForTenant,
  listWorkoutsInPlan,
  updateWorkout,
  WorkoutError,
} from "./workouts";

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

describe("addWorkoutExercisesBatch (BK-01)", () => {
  it("adiciona vários exercícios no fim, com 3 × 12 e 60 s, numa ordem estável", async () => {
    const { tenant } = await createTenant("lote");
    const a = await globalExercise("lote-a");
    const b = await globalExercise("lote-b");
    const c = await globalExercise("lote-c");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino lote ${run}` }, prisma);
    await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: a.id, sets: 4, reps: 8 }, prisma);

    const created = await addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: workout.id, exerciseIds: [b.id, c.id] }, prisma);

    expect(created).toHaveLength(2);
    const items = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(items.map((item) => item.exerciseId)).toEqual([a.id, b.id, c.id]);
    expect(items.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(items[1]).toMatchObject({ sets: DEFAULT_PRESCRIPTION.sets, reps: DEFAULT_PRESCRIPTION.reps, restSeconds: DEFAULT_PRESCRIPTION.restSeconds, load: null });
  });

  it("recusa o lote inteiro se um exercício não for visível ao tenant (nada é criado)", async () => {
    const { tenant } = await createTenant("lote-inv");
    const { tenant: other } = await createTenant("lote-outro");
    const visible = await globalExercise("lote-vis");
    const foreign = await prisma.exercise.create({ data: { tenantId: other.id, origin: "PERSONAL", name: `Próprio outro ${run}` } });
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino inv ${run}` }, prisma);

    await expect(
      addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: workout.id, exerciseIds: [visible.id, foreign.id] }, prisma)
    ).rejects.toMatchObject({ kind: "EXERCICIO_INVALIDO" });
    expect(await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma)).toHaveLength(0);
  });

  it("não encontra treino de outro tenant e recusa lista vazia", async () => {
    const { tenant } = await createTenant("lote-iso");
    const { tenant: other } = await createTenant("lote-iso-b");
    const ex = await globalExercise("lote-iso");
    const foreignWorkout = await createWorkout({ tenantId: other.id, name: `Treino alheio ${run}` }, prisma);
    await expect(addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: foreignWorkout.id, exerciseIds: [ex.id] }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(addWorkoutExercisesBatch({ tenantId: other.id, workoutId: foreignWorkout.id, exerciseIds: [] }, prisma)).rejects.toBeInstanceOf(WorkoutError);
  });
});

describe("resumos de treinos e programas (FIT-146)", () => {
  it("lista ativos ou arquivados com contagem, dias, programa e fotos dos três primeiros", async () => {
    const { tenant } = await createTenant("resumo");
    const exs = await Promise.all([1, 2, 3, 4].map((n) => globalExercise(`resumo-${n}`, `/media/exercises/${n}.webp`)));
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino A ${run}` }, prisma);
    await updateWorkout({ tenantId: tenant.id, workoutId: workout.id, suggestedDays: ["SEGUNDA", "QUINTA"] }, prisma);
    await addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: workout.id, exerciseIds: exs.map((e) => e.id) }, prisma);
    const archived = await createWorkout({ tenantId: tenant.id, name: `Treino velho ${run}` }, prisma);
    await archiveWorkout({ tenantId: tenant.id, workoutId: archived.id }, prisma);

    const active = await listWorkoutSummariesForTenant({ tenantId: tenant.id }, prisma);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ name: `Treino A ${run}`, exerciseCount: 4, suggestedDays: ["SEGUNDA", "QUINTA"], trainingPlanName: null });
    expect(active[0]!.thumbnails.map((t) => t.imageUrl)).toEqual(["/media/exercises/1.webp", "/media/exercises/2.webp", "/media/exercises/3.webp"]);

    const old = await listWorkoutSummariesForTenant({ tenantId: tenant.id, status: "ARQUIVADO" }, prisma);
    expect(old.map((w) => w.id)).toEqual([archived.id]);
  });

  it("resumo de programa une os dias dos treinos e ignora rascunho", async () => {
    const { tenant } = await createTenant("resumo-plano");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Hipertrofia ${run}`, durationWeeks: 8 }, prisma);
    const a = await createWorkout({ tenantId: tenant.id, name: `A ${run}` }, prisma);
    await updateWorkout({ tenantId: tenant.id, workoutId: a.id, suggestedDays: ["SEGUNDA", "QUINTA"] }, prisma);
    const b = await createWorkout({ tenantId: tenant.id, name: `B ${run}` }, prisma);
    await updateWorkout({ tenantId: tenant.id, workoutId: b.id, suggestedDays: ["TERCA", "QUINTA"] }, prisma);
    await addWorkoutToPlan({ tenantId: tenant.id, workoutId: a.id, targetTrainingPlanId: plan.id }, prisma);
    await addWorkoutToPlan({ tenantId: tenant.id, workoutId: b.id, targetTrainingPlanId: plan.id }, prisma);

    const summaries = await listTrainingPlanSummariesForTenant({ tenantId: tenant.id }, prisma);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ name: `Hipertrofia ${run}`, durationWeeks: 8, workoutCount: 2 });
    expect([...summaries[0]!.days].sort()).toEqual(["QUINTA", "SEGUNDA", "TERCA"]);
  });
});

describe("addWorkoutToPlan (FIT-146)", () => {
  it("move treino de Meus modelos, mas copia treino que já está em outro programa", async () => {
    const { tenant } = await createTenant("colocar");
    const ex = await globalExercise("colocar");
    const p1 = await createTrainingPlan({ tenantId: tenant.id, name: `P1 ${run}` }, prisma);
    const p2 = await createTrainingPlan({ tenantId: tenant.id, name: `P2 ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);
    await addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: workout.id, exerciseIds: [ex.id] }, prisma);

    const first = await addWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: p1.id }, prisma);
    expect(first).toMatchObject({ copied: false });
    expect(first.workout.id).toBe(workout.id);

    const second = await addWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: p2.id }, prisma);
    expect(second.copied).toBe(true);
    expect(second.workout.id).not.toBe(workout.id);
    expect((await listWorkoutsInPlan({ tenantId: tenant.id, trainingPlanId: p1.id }, prisma)).map((w) => w.id)).toEqual([workout.id]);
    expect(await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: second.workout.id }, prisma)).toHaveLength(1);
  });

  it("não aceita programa de outro tenant", async () => {
    const { tenant } = await createTenant("colocar-iso");
    const { tenant: other } = await createTenant("colocar-iso-b");
    const plan = await createTrainingPlan({ tenantId: other.id, name: `Alheio ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `T ${run}` }, prisma);
    await expect(addWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("assignTrainingPlanToStudents (BK-03)", () => {
  it("atribui a vários alunos, cada um com sua cópia, e mostra o programa ativo de cada um", async () => {
    const { owner, tenant } = await createTenant("lote-atrib");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Programa ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `T ${run}` }, prisma);
    await addWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);
    const s1 = await prisma.student.create({ data: { tenantId: tenant.id, email: `s1-${run}@example.test`, displayName: "Ana" } });
    const s2 = await prisma.student.create({ data: { tenantId: tenant.id, email: `s2-${run}@example.test`, displayName: "Bruno" } });

    const assignments = await assignTrainingPlanToStudents({ tenantId: tenant.id, actorUserId: owner.id, trainingPlanId: plan.id, studentIds: [s1.id, s2.id, s1.id] }, prisma);

    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((a) => a.trainingPlanId)).size).toBe(2);
    const students = await listAssignableStudents({ tenantId: tenant.id }, prisma);
    expect(students.map((s) => [s.displayName, s.activePlanName])).toEqual([
      ["Ana", `Programa ${run}`],
      ["Bruno", `Programa ${run}`],
    ]);
  });

  it("recusa o lote inteiro se houver aluno inativo ou de outro tenant", async () => {
    const { owner, tenant } = await createTenant("lote-atrib-inv");
    const { tenant: other } = await createTenant("lote-atrib-inv-b");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Programa X ${run}` }, prisma);
    const ok = await prisma.student.create({ data: { tenantId: tenant.id, email: `ok-${run}@example.test`, displayName: "Ok" } });
    const inactive = await prisma.student.create({ data: { tenantId: tenant.id, email: `in-${run}@example.test`, displayName: "In", status: "INATIVO" } });
    const foreign = await prisma.student.create({ data: { tenantId: other.id, email: `fo-${run}@example.test`, displayName: "Fo" } });

    await expect(assignTrainingPlanToStudents({ tenantId: tenant.id, actorUserId: owner.id, trainingPlanId: plan.id, studentIds: [ok.id, inactive.id] }, prisma)).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    await expect(assignTrainingPlanToStudents({ tenantId: tenant.id, actorUserId: owner.id, trainingPlanId: plan.id, studentIds: [ok.id, foreign.id] }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    expect(await prisma.planAssignment.count({ where: { studentId: ok.id } })).toBe(0);
  });
});
