// @vitest-environment node
//
// Testes de integração do modelo de treino (FIT-030) contra PostgreSQL
// real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createOwnExercise } from "@/modules/exercises/exercises";
import {
  addWorkoutExercise,
  archiveTrainingPlan,
  archiveWorkout,
  assignTrainingPlanToStudent,
  createTrainingPlan,
  createWorkout,
  duplicateWorkout,
  getActivePlanAssignmentForStudent,
  getTrainingPlanForTenant,
  getWorkoutExerciseForTenant,
  getWorkoutForTenant,
  listEndedPlanAssignmentsForStudent,
  listTrainingPlansForTenant,
  listWorkoutExercisesForWorkout,
  listWorkoutsAvailableForPlan,
  listWorkoutsForTenant,
  listWorkoutsInPlan,
  moveWorkoutToPlan,
  reactivateTrainingPlan,
  reactivateWorkout,
  removeWorkoutExercise,
  removeWorkoutFromPlan,
  reorderWorkoutExercises,
  reorderWorkoutsInPlan,
  unassignTrainingPlanFromStudent,
  updateTrainingPlan,
  updateWorkout,
  updateWorkoutExercise,
  WorkoutError,
} from "./workouts";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  // O TRIGGER de imutabilidade de snapshot (ADR-005) rejeita fisicamente
  // qualquer DELETE em workouts/workout_exercises de um plano com
  // isSnapshot=true — inclusive o DELETE disparado por ON DELETE CASCADE a
  // partir do tenant. Isso é intencional em uso normal (nunca existe uma
  // rotina de produto que precise apagar um snapshot já criado), mas a
  // limpeza de dados sintéticos deste teste precisa desligar temporariamente
  // os dois TRIGGERs de imutabilidade (privilégio de dono da tabela, não
  // exige superusuário) para conseguir remover o snapshot criado de
  // propósito no teste "imutabilidade de snapshot" abaixo.
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  // `plan_assignments.trainingPlanId` é `onDelete: Restrict` — precisa ser
  // removido antes de `trainingPlan.deleteMany` (FIT-033), senão o DELETE
  // do plano-snapshot ainda referenciado falha.
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function createGlobalExercise(label: string) {
  return prisma.exercise.create({
    data: { tenantId: null, origin: "API_NINJAS", name: `Global ${label} ${run}` },
  });
}

async function createStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
}

/// Cria um plano com dois modelos (dois itens cada), pronto para os testes
/// de atribuição (FIT-033) — evita repetir esse setup em cada `it`.
async function createPlanWithWorkoutsAndItems(tenantId: string, label: string) {
  const exerciseA = await createGlobalExercise(`${label}-ex-a`);
  const exerciseB = await createGlobalExercise(`${label}-ex-b`);
  const plan = await createTrainingPlan({ tenantId, name: `Plano ${label} ${run}`, durationWeeks: 4 }, prisma);

  const workoutA = await createWorkout({ tenantId, name: `Treino A ${label} ${run}` }, prisma);
  await moveWorkoutToPlan({ tenantId, workoutId: workoutA.id, targetTrainingPlanId: plan.id }, prisma);
  await addWorkoutExercise({ tenantId, workoutId: workoutA.id, exerciseId: exerciseA.id, sets: 3, reps: 10 }, prisma);

  const workoutB = await createWorkout({ tenantId, name: `Treino B ${label} ${run}` }, prisma);
  await moveWorkoutToPlan({ tenantId, workoutId: workoutB.id, targetTrainingPlanId: plan.id }, prisma);
  await addWorkoutExercise({ tenantId, workoutId: workoutB.id, exerciseId: exerciseB.id, sets: 4, reps: 8 }, prisma);

  return { plan, workoutA, workoutB, exerciseA, exerciseB };
}

describe("createWorkout (FIT-030)", () => {
  it("cria um modelo no plano rascunho do tenant, sempre ATIVO e com posição sequencial", async () => {
    const { tenant } = await createTenant("criar");

    const first = await createWorkout({ tenantId: tenant.id, name: `Treino A ${run}` }, prisma);
    const second = await createWorkout({ tenantId: tenant.id, name: `Treino B ${run}` }, prisma);

    expect(first.status).toBe("ATIVO");
    expect(first.tenantId).toBe(tenant.id);
    expect(second.trainingPlanId).toBe(first.trainingPlanId);
    expect(second.position).toBe(first.position + 1);

    const plan = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: first.trainingPlanId } });
    expect(plan.isSnapshot).toBe(false);
  });

  it("rejeita nome vazio", async () => {
    const { tenant } = await createTenant("nome-vazio");
    await expect(createWorkout({ tenantId: tenant.id, name: "   " }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });
});

describe("getWorkoutForTenant / listWorkoutsForTenant (FIT-030)", () => {
  it("isolamento: nunca retorna modelo de outro tenant", async () => {
    const { tenant: tenantA } = await createTenant("isolamento-a");
    const { tenant: tenantB } = await createTenant("isolamento-b");
    const workout = await createWorkout({ tenantId: tenantA.id, name: `Treino isolado ${run}` }, prisma);

    const foundByOwner = await getWorkoutForTenant({ tenantId: tenantA.id, workoutId: workout.id }, prisma);
    const foundByOther = await getWorkoutForTenant({ tenantId: tenantB.id, workoutId: workout.id }, prisma);

    expect(foundByOwner?.id).toBe(workout.id);
    expect(foundByOther).toBeNull();
  });

  it("lista apenas modelos ATIVOS do próprio tenant", async () => {
    const { tenant } = await createTenant("listagem");
    const active = await createWorkout({ tenantId: tenant.id, name: `Ativo ${run}` }, prisma);
    const toArchive = await createWorkout({ tenantId: tenant.id, name: `Arquivado ${run}` }, prisma);
    await archiveWorkout({ tenantId: tenant.id, workoutId: toArchive.id }, prisma);

    const list = await listWorkoutsForTenant({ tenantId: tenant.id }, prisma);

    expect(list.map((w) => w.id)).toContain(active.id);
    expect(list.map((w) => w.id)).not.toContain(toArchive.id);
  });
});

describe("updateWorkout (FIT-030)", () => {
  it("edita nome e dias sugeridos, preservando tenantId/trainingPlanId", async () => {
    const { tenant } = await createTenant("editar");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Original ${run}` }, prisma);

    const updated = await updateWorkout(
      { tenantId: tenant.id, workoutId: workout.id, name: `Editado ${run}`, suggestedDays: ["SEGUNDA", "QUARTA"] },
      prisma
    );

    expect(updated.name).toBe(`Editado ${run}`);
    expect(updated.suggestedDays).toEqual(["SEGUNDA", "QUARTA"]);
    expect(updated.tenantId).toBe(tenant.id);
    expect(updated.trainingPlanId).toBe(workout.trainingPlanId);
  });

  it("rejeita edição de modelo de outro tenant (NAO_ENCONTRADO, sem revelar existência)", async () => {
    const { tenant: tenantA } = await createTenant("editar-cruzado-a");
    const { tenant: tenantB } = await createTenant("editar-cruzado-b");
    const workout = await createWorkout({ tenantId: tenantA.id, name: `Do tenant A ${run}` }, prisma);

    await expect(
      updateWorkout({ tenantId: tenantB.id, workoutId: workout.id, name: "Tentativa" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("archiveWorkout / reactivateWorkout (FIT-030)", () => {
  it("arquivamento e reativação são idempotentes e nunca excluem fisicamente", async () => {
    const { tenant } = await createTenant("ciclo-de-vida");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Ciclo ${run}` }, prisma);

    const archivedOnce = await archiveWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    const archivedTwice = await archiveWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(archivedOnce.status).toBe("ARQUIVADO");
    expect(archivedTwice.status).toBe("ARQUIVADO");

    const reactivatedOnce = await reactivateWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    const reactivatedTwice = await reactivateWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(reactivatedOnce.status).toBe("ATIVO");
    expect(reactivatedTwice.status).toBe("ATIVO");

    const stillExists = await prisma.workout.findUnique({ where: { id: workout.id } });
    expect(stillExists).not.toBeNull();
  });
});

describe("addWorkoutExercise (FIT-030)", () => {
  it("aceita exercício global e exercício próprio do tenant, em posições sequenciais", async () => {
    const { owner, tenant } = await createTenant("adicionar");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const globalExercise = await createGlobalExercise("supino");
    const ownExercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Rosca ${run}` },
      prisma
    );

    const first = await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: workout.id, exerciseId: globalExercise.id, sets: 3, reps: 10 },
      prisma
    );
    const second = await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: workout.id, exerciseId: ownExercise.id, durationSeconds: 45 },
      prisma
    );

    expect(first.position).toBe(0);
    expect(first.sets).toBe(3);
    expect(first.reps).toBe(10);
    expect(second.position).toBe(1);
    expect(second.durationSeconds).toBe(45);
  });

  it("rejeita exercício próprio de outro tenant (EXERCICIO_INVALIDO)", async () => {
    const { owner: ownerA, tenant: tenantA } = await createTenant("exercicio-cruzado-a");
    const { tenant: tenantB } = await createTenant("exercicio-cruzado-b");
    const workoutB = await createWorkout({ tenantId: tenantB.id, name: `Modelo B ${run}` }, prisma);
    const exerciseA = await createOwnExercise(
      { tenantId: tenantA.id, actorUserId: ownerA.id, name: `Exclusivo A ${run}` },
      prisma
    );

    await expect(
      addWorkoutExercise({ tenantId: tenantB.id, workoutId: workoutB.id, exerciseId: exerciseA.id }, prisma)
    ).rejects.toMatchObject({ kind: "EXERCICIO_INVALIDO" });
  });

  it("rejeita modelo inexistente/de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("modelo-cruzado-a");
    const { tenant: tenantB } = await createTenant("modelo-cruzado-b");
    const workoutA = await createWorkout({ tenantId: tenantA.id, name: `Modelo A ${run}` }, prisma);
    const globalExercise = await createGlobalExercise("agachamento");

    await expect(
      addWorkoutExercise({ tenantId: tenantB.id, workoutId: workoutA.id, exerciseId: globalExercise.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("validação: séries/repetições/duração/descanso precisam ser inteiros positivos", async () => {
    const { tenant } = await createTenant("validacao-prescricao");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const globalExercise = await createGlobalExercise("prancha");

    await expect(
      addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: globalExercise.id, sets: -1 }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("removeWorkoutExercise (FIT-030)", () => {
  it("remove um item e fecha o buraco de posição deixado", async () => {
    const { tenant } = await createTenant("remover");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const exerciseA = await createGlobalExercise("remover-a");
    const exerciseB = await createGlobalExercise("remover-b");
    const exerciseC = await createGlobalExercise("remover-c");

    const itemA = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseA.id }, prisma);
    const itemB = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseB.id }, prisma);
    const itemC = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseC.id }, prisma);
    expect([itemA.position, itemB.position, itemC.position]).toEqual([0, 1, 2]);

    await removeWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: itemB.id }, prisma);

    const remaining = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(remaining.map((item) => item.id)).toEqual([itemA.id, itemC.id]);
    expect(remaining.map((item) => item.position)).toEqual([0, 1]);
  });

  it("rejeita remoção de item de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("remover-cruzado-a");
    const { tenant: tenantB } = await createTenant("remover-cruzado-b");
    const workoutA = await createWorkout({ tenantId: tenantA.id, name: `Modelo A ${run}` }, prisma);
    const exercise = await createGlobalExercise("remover-cruzado");
    const item = await addWorkoutExercise({ tenantId: tenantA.id, workoutId: workoutA.id, exerciseId: exercise.id }, prisma);

    await expect(
      removeWorkoutExercise({ tenantId: tenantB.id, workoutId: workoutA.id, workoutExerciseId: item.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("updateWorkoutExercise (FIT-030)", () => {
  it("edita parâmetros de prescrição; string vazia/null limpa o campo", async () => {
    const { tenant } = await createTenant("editar-item");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const exercise = await createGlobalExercise("editar-item");
    const item = await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, sets: 3, load: "20kg" },
      prisma
    );

    const updated = await updateWorkoutExercise(
      { tenantId: tenant.id, workoutId: workout.id, workoutExerciseId: item.id, sets: 4, load: "" },
      prisma
    );

    expect(updated.sets).toBe(4);
    expect(updated.load).toBeNull();
  });
});

describe("reorderWorkoutExercises (FIT-030)", () => {
  it("reordena conforme a lista enviada", async () => {
    const { tenant } = await createTenant("reordenar");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const exerciseA = await createGlobalExercise("reordenar-a");
    const exerciseB = await createGlobalExercise("reordenar-b");
    const itemA = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseA.id }, prisma);
    const itemB = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseB.id }, prisma);

    await reorderWorkoutExercises({ tenantId: tenant.id, workoutId: workout.id, orderedIds: [itemB.id, itemA.id] }, prisma);

    const reordered = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);
    expect(reordered.map((item) => item.id)).toEqual([itemB.id, itemA.id]);
    expect(reordered.map((item) => item.position)).toEqual([0, 1]);
  });

  it("rejeita lista que não corresponde exatamente aos itens existentes", async () => {
    const { tenant } = await createTenant("reordenar-invalido");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const exercise = await createGlobalExercise("reordenar-invalido");
    const item = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id }, prisma);

    await expect(
      reorderWorkoutExercises({ tenantId: tenant.id, workoutId: workout.id, orderedIds: [item.id, "inexistente"] }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("duplicateWorkout (FIT-031)", () => {
  it("cria uma cópia independente, com o nome marcado, no mesmo plano do original", async () => {
    const { tenant } = await createTenant("duplicar");
    const original = await createWorkout({ tenantId: tenant.id, name: `Treino A ${run}` }, prisma);
    const exerciseA = await createGlobalExercise("duplicar-a");
    const exerciseB = await createGlobalExercise("duplicar-b");
    await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: original.id, exerciseId: exerciseA.id, sets: 3, reps: 10 },
      prisma
    );
    await addWorkoutExercise({ tenantId: tenant.id, workoutId: original.id, exerciseId: exerciseB.id, load: "20kg" }, prisma);
    await updateWorkout({ tenantId: tenant.id, workoutId: original.id, suggestedDays: ["SEGUNDA"] }, prisma);

    const clone = await duplicateWorkout({ tenantId: tenant.id, workoutId: original.id }, prisma);

    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe(`Treino A ${run} (cópia)`);
    expect(clone.trainingPlanId).toBe(original.trainingPlanId);
    expect(clone.suggestedDays).toEqual(["SEGUNDA"]);

    const cloneItems = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: clone.id }, prisma);
    expect(cloneItems).toHaveLength(2);
    expect(cloneItems.map((item) => item.exerciseId)).toEqual([exerciseA.id, exerciseB.id]);
    expect(cloneItems.map((item) => item.position)).toEqual([0, 1]);
    expect(cloneItems[0]?.sets).toBe(3);
    expect(cloneItems[0]?.reps).toBe(10);
    expect(cloneItems[1]?.load).toBe("20kg");
    expect(cloneItems.every((item) => item.id !== original.id)).toBe(true);
  });

  it("editar a cópia não afeta o original, e editar o original não afeta a cópia já criada", async () => {
    const { tenant } = await createTenant("duplicar-independente");
    const original = await createWorkout({ tenantId: tenant.id, name: `Treino B ${run}` }, prisma);
    const exercise = await createGlobalExercise("duplicar-independente");
    const originalItem = await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: original.id, exerciseId: exercise.id, sets: 3 },
      prisma
    );

    const clone = await duplicateWorkout({ tenantId: tenant.id, workoutId: original.id }, prisma);
    const cloneItems = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: clone.id }, prisma);
    const cloneItem = cloneItems[0]!;

    await updateWorkoutExercise({ tenantId: tenant.id, workoutId: clone.id, workoutExerciseId: cloneItem.id, sets: 99 }, prisma);
    const originalUnchanged = await getWorkoutExerciseForTenant(
      { tenantId: tenant.id, workoutId: original.id, workoutExerciseId: originalItem.id },
      prisma
    );
    expect(originalUnchanged?.sets).toBe(3);

    await updateWorkoutExercise({ tenantId: tenant.id, workoutId: original.id, workoutExerciseId: originalItem.id, sets: 1 }, prisma);
    const cloneUnchanged = await getWorkoutExerciseForTenant(
      { tenantId: tenant.id, workoutId: clone.id, workoutExerciseId: cloneItem.id },
      prisma
    );
    expect(cloneUnchanged?.sets).toBe(99);
  });

  it("duplica um modelo sem itens", async () => {
    const { tenant } = await createTenant("duplicar-vazio");
    const original = await createWorkout({ tenantId: tenant.id, name: `Treino C ${run}` }, prisma);

    const clone = await duplicateWorkout({ tenantId: tenant.id, workoutId: original.id }, prisma);
    const cloneItems = await listWorkoutExercisesForWorkout({ tenantId: tenant.id, workoutId: clone.id }, prisma);

    expect(cloneItems).toHaveLength(0);
    expect(clone.name).toBe(`Treino C ${run} (cópia)`);
  });

  it("rejeita duplicação de modelo de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("duplicar-cruzado-a");
    const { tenant: tenantB } = await createTenant("duplicar-cruzado-b");
    const workoutA = await createWorkout({ tenantId: tenantA.id, name: `Treino D ${run}` }, prisma);

    await expect(duplicateWorkout({ tenantId: tenantB.id, workoutId: workoutA.id }, prisma)).rejects.toMatchObject({
      kind: "NAO_ENCONTRADO",
    });
  });
});

describe("createTrainingPlan / getTrainingPlanForTenant / listTrainingPlansForTenant (FIT-032)", () => {
  it("cria um plano com nome e vigência sugerida, sempre ATIVO e não-snapshot", async () => {
    const { tenant } = await createTenant("criar-plano");

    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano A ${run}`, durationWeeks: 4 }, prisma);

    expect(plan.status).toBe("ATIVO");
    expect(plan.isSnapshot).toBe(false);
    expect(plan.durationWeeks).toBe(4);
    expect(plan.tenantId).toBe(tenant.id);
  });

  it("rejeita nome vazio", async () => {
    const { tenant } = await createTenant("plano-nome-vazio");
    await expect(createTrainingPlan({ tenantId: tenant.id, name: "   " }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });

  it("isolamento: nunca retorna plano de outro tenant", async () => {
    const { tenant: tenantA } = await createTenant("plano-isolamento-a");
    const { tenant: tenantB } = await createTenant("plano-isolamento-b");
    const plan = await createTrainingPlan({ tenantId: tenantA.id, name: `Plano isolado ${run}` }, prisma);

    const foundByOwner = await getTrainingPlanForTenant({ tenantId: tenantA.id, trainingPlanId: plan.id }, prisma);
    const foundByOther = await getTrainingPlanForTenant({ tenantId: tenantB.id, trainingPlanId: plan.id }, prisma);

    expect(foundByOwner?.id).toBe(plan.id);
    expect(foundByOther).toBeNull();
  });

  it("nunca retorna um plano snapshot", async () => {
    const { tenant } = await createTenant("plano-snapshot-oculto");
    const snapshot = await prisma.trainingPlan.create({
      data: { tenantId: tenant.id, name: `Snapshot ${run}`, isSnapshot: true },
    });

    const found = await getTrainingPlanForTenant({ tenantId: tenant.id, trainingPlanId: snapshot.id }, prisma);
    expect(found).toBeNull();
  });

  it("lista apenas planos ATIVOS e não-snapshot do próprio tenant", async () => {
    const { tenant } = await createTenant("listagem-planos");
    const active = await createTrainingPlan({ tenantId: tenant.id, name: `Ativo ${run}` }, prisma);
    const toArchive = await createTrainingPlan({ tenantId: tenant.id, name: `Arquivado ${run}` }, prisma);
    await archiveTrainingPlan({ tenantId: tenant.id, trainingPlanId: toArchive.id }, prisma);

    const list = await listTrainingPlansForTenant({ tenantId: tenant.id }, prisma);

    expect(list.map((p) => p.id)).toContain(active.id);
    expect(list.map((p) => p.id)).not.toContain(toArchive.id);
  });

  it("nunca inclui o plano rascunho implícito, mesmo depois de criado", async () => {
    const { tenant } = await createTenant("listagem-sem-rascunho");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);

    const list = await listTrainingPlansForTenant({ tenantId: tenant.id }, prisma);

    expect(list.map((p) => p.id)).not.toContain(workout.trainingPlanId);
  });

  it("regressão: criar um plano real antes de qualquer modelo avulso não faz esse plano ser confundido com o rascunho", async () => {
    const { tenant } = await createTenant("regressao-rascunho");

    // Cria um plano real ANTES de qualquer modelo avulso — com a heurística
    // antiga (primeiro TrainingPlan por createdAt), este seria erroneamente
    // tratado como o "rascunho" na próxima criação de modelo avulso.
    const realPlan = await createTrainingPlan({ tenantId: tenant.id, name: `Programa real ${run}` }, prisma);

    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo avulso ${run}` }, prisma);

    expect(workout.trainingPlanId).not.toBe(realPlan.id);

    const draftPlan = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: workout.trainingPlanId } });
    expect(draftPlan.isDraftBucket).toBe(true);

    // O plano real nunca é marcado como rascunho e continua visível na
    // listagem voltada ao personal; o rascunho nunca aparece nela.
    const list = await listTrainingPlansForTenant({ tenantId: tenant.id }, prisma);
    expect(list.map((p) => p.id)).toEqual([realPlan.id]);
  });
});

describe("updateTrainingPlan (FIT-032)", () => {
  it("edita nome e vigência sugerida", async () => {
    const { tenant } = await createTenant("editar-plano");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Original ${run}` }, prisma);

    const updated = await updateTrainingPlan(
      { tenantId: tenant.id, trainingPlanId: plan.id, name: `Editado ${run}`, durationWeeks: 6 },
      prisma
    );

    expect(updated.name).toBe(`Editado ${run}`);
    expect(updated.durationWeeks).toBe(6);
  });

  it("rejeita edição de plano de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("editar-plano-cruzado-a");
    const { tenant: tenantB } = await createTenant("editar-plano-cruzado-b");
    const plan = await createTrainingPlan({ tenantId: tenantA.id, name: `Do tenant A ${run}` }, prisma);

    await expect(
      updateTrainingPlan({ tenantId: tenantB.id, trainingPlanId: plan.id, name: "Tentativa" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("archiveTrainingPlan / reactivateTrainingPlan (FIT-032)", () => {
  it("arquivamento e reativação são idempotentes e nunca excluem fisicamente; modelos agrupados permanecem intactos", async () => {
    const { tenant } = await createTenant("ciclo-de-vida-plano");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Ciclo ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);

    const archivedOnce = await archiveTrainingPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    const archivedTwice = await archiveTrainingPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    expect(archivedOnce.status).toBe("ARQUIVADO");
    expect(archivedTwice.status).toBe("ARQUIVADO");

    const reactivatedOnce = await reactivateTrainingPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    const reactivatedTwice = await reactivateTrainingPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    expect(reactivatedOnce.status).toBe("ATIVO");
    expect(reactivatedTwice.status).toBe("ATIVO");

    const stillInPlan = await listWorkoutsInPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    expect(stillInPlan.map((w) => w.id)).toContain(workout.id);
  });
});

describe("moveWorkoutToPlan / removeWorkoutFromPlan / reorderWorkoutsInPlan (FIT-032)", () => {
  it("move um modelo do plano rascunho para um plano novo, fechando o buraco de posição na origem", async () => {
    const { tenant } = await createTenant("mover-modelo");
    const workoutA = await createWorkout({ tenantId: tenant.id, name: `A ${run}` }, prisma);
    const workoutB = await createWorkout({ tenantId: tenant.id, name: `B ${run}` }, prisma);
    const draftPlanId = workoutA.trainingPlanId;
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);

    const moved = await moveWorkoutToPlan(
      { tenantId: tenant.id, workoutId: workoutA.id, targetTrainingPlanId: plan.id },
      prisma
    );

    expect(moved.trainingPlanId).toBe(plan.id);
    expect(moved.position).toBe(0);

    const remainingInDraft = await listWorkoutsInPlan({ tenantId: tenant.id, trainingPlanId: draftPlanId }, prisma);
    expect(remainingInDraft.map((w) => w.id)).toEqual([workoutB.id]);
    expect(remainingInDraft[0]?.position).toBe(0);
  });

  it("mover para o mesmo plano é um no-op", async () => {
    const { tenant } = await createTenant("mover-noop");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);

    const result = await moveWorkoutToPlan(
      { tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: workout.trainingPlanId },
      prisma
    );

    expect(result.id).toBe(workout.id);
    expect(result.position).toBe(workout.position);
  });

  it("rejeita mover modelo de outro tenant, ou para plano de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("mover-cruzado-a");
    const { tenant: tenantB } = await createTenant("mover-cruzado-b");
    const workoutA = await createWorkout({ tenantId: tenantA.id, name: `A ${run}` }, prisma);
    const planB = await createTrainingPlan({ tenantId: tenantB.id, name: `Plano B ${run}` }, prisma);

    await expect(
      moveWorkoutToPlan({ tenantId: tenantB.id, workoutId: workoutA.id, targetTrainingPlanId: planB.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });

    const planA = await createTrainingPlan({ tenantId: tenantA.id, name: `Plano A ${run}` }, prisma);
    await expect(
      moveWorkoutToPlan({ tenantId: tenantA.id, workoutId: workoutA.id, targetTrainingPlanId: planA.id }, prisma)
    ).resolves.toMatchObject({ trainingPlanId: planA.id });
  });

  it("listWorkoutsAvailableForPlan exclui os modelos já pertencentes ao plano informado", async () => {
    const { tenant } = await createTenant("disponiveis-para-plano");
    const workoutInPlan = await createWorkout({ tenantId: tenant.id, name: `Dentro ${run}` }, prisma);
    const workoutOutside = await createWorkout({ tenantId: tenant.id, name: `Fora ${run}` }, prisma);
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workoutInPlan.id, targetTrainingPlanId: plan.id }, prisma);

    const available = await listWorkoutsAvailableForPlan({ tenantId: tenant.id, excludeTrainingPlanId: plan.id }, prisma);

    expect(available.map((w) => w.id)).toContain(workoutOutside.id);
    expect(available.map((w) => w.id)).not.toContain(workoutInPlan.id);
  });

  it("removeWorkoutFromPlan move o modelo de volta para o plano rascunho do tenant", async () => {
    const { tenant } = await createTenant("remover-do-plano");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const draftPlanId = workout.trainingPlanId;
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);

    const removed = await removeWorkoutFromPlan(
      { tenantId: tenant.id, workoutId: workout.id, trainingPlanId: plan.id },
      prisma
    );

    expect(removed.trainingPlanId).toBe(draftPlanId);
  });

  it("removeWorkoutFromPlan rejeita quando o modelo não pertence ao plano informado", async () => {
    const { tenant } = await createTenant("remover-do-plano-errado");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    const otherPlan = await createTrainingPlan({ tenantId: tenant.id, name: `Outro plano ${run}` }, prisma);

    await expect(
      removeWorkoutFromPlan({ tenantId: tenant.id, workoutId: workout.id, trainingPlanId: otherPlan.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("reorderWorkoutsInPlan reordena os modelos dentro do plano", async () => {
    const { tenant } = await createTenant("reordenar-plano");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);
    const workoutA = await createWorkout({ tenantId: tenant.id, name: `A ${run}` }, prisma);
    const workoutB = await createWorkout({ tenantId: tenant.id, name: `B ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workoutA.id, targetTrainingPlanId: plan.id }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workoutB.id, targetTrainingPlanId: plan.id }, prisma);

    await reorderWorkoutsInPlan(
      { tenantId: tenant.id, trainingPlanId: plan.id, orderedWorkoutIds: [workoutB.id, workoutA.id] },
      prisma
    );

    const reordered = await listWorkoutsInPlan({ tenantId: tenant.id, trainingPlanId: plan.id }, prisma);
    expect(reordered.map((w) => w.id)).toEqual([workoutB.id, workoutA.id]);
  });

  it("reorderWorkoutsInPlan rejeita lista que não corresponde exatamente aos modelos do plano", async () => {
    const { tenant } = await createTenant("reordenar-plano-invalido");
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `Modelo ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);

    await expect(
      reorderWorkoutsInPlan(
        { tenantId: tenant.id, trainingPlanId: plan.id, orderedWorkoutIds: [workout.id, "inexistente"] },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("imutabilidade de snapshot (ADR-005) — TRIGGER físico", () => {
  it("rejeita INSERT/UPDATE/DELETE em workouts/workout_exercises de um TrainingPlan com isSnapshot=true", async () => {
    const { tenant } = await createTenant("snapshot-trigger");
    const globalExercise = await createGlobalExercise("snapshot-trigger");

    // Constrói um "snapshot" diretamente via Prisma (fora do fluxo real da
    // FIT-033, que só existirá depois) só para provar que o TRIGGER
    // funciona de forma isolada desta História, com isSnapshot já true.
    const snapshotPlan = await prisma.trainingPlan.create({
      data: { tenantId: tenant.id, name: `Snapshot ${run}`, isSnapshot: true },
    });

    await expect(
      prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: snapshotPlan.id, name: "X", position: 0 } })
    ).rejects.toThrow();

    // Cria um Workout normal (plano ainda não-snapshot) e só então marca o
    // plano como snapshot, para testar UPDATE/DELETE sobre um Workout já
    // existente sob um plano agora imutável.
    const draftPlan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: `Rascunho ${run}` } });
    const workout = await prisma.workout.create({
      data: { tenantId: tenant.id, trainingPlanId: draftPlan.id, name: "Y", position: 0 },
    });
    const item = await prisma.workoutExercise.create({
      data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: globalExercise.id, position: 0 },
    });
    await prisma.trainingPlan.update({ where: { id: draftPlan.id }, data: { isSnapshot: true } });

    await expect(prisma.workout.update({ where: { id: workout.id }, data: { name: "Z" } })).rejects.toThrow();
    await expect(
      prisma.workoutExercise.update({ where: { id: item.id }, data: { sets: 5 } })
    ).rejects.toThrow();
    await expect(prisma.workoutExercise.delete({ where: { id: item.id } })).rejects.toThrow();
    await expect(prisma.workout.delete({ where: { id: workout.id } })).rejects.toThrow();

    // isSnapshot nunca pode voltar a false.
    await expect(
      prisma.trainingPlan.update({ where: { id: draftPlan.id }, data: { isSnapshot: false } })
    ).rejects.toThrow();
  });
});

describe("assignTrainingPlanToStudent (FIT-033)", () => {
  it("cria uma cópia imutável (snapshot) do plano, com modelos e itens preservados na mesma ordem", async () => {
    const { tenant, owner } = await createTenant("atribuir-snapshot");
    const student = await createStudent(tenant.id, "atribuir-snapshot");
    const { plan, workoutA, workoutB } = await createPlanWithWorkoutsAndItems(tenant.id, "atribuir-snapshot");

    const assignment = await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: plan.id },
      prisma
    );

    expect(assignment.studentId).toBe(student.id);
    expect(assignment.active).toBe(true);
    expect(assignment.endedAt).toBeNull();
    expect(assignment.trainingPlanId).not.toBe(plan.id);

    const snapshot = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: assignment.trainingPlanId } });
    expect(snapshot.isSnapshot).toBe(true);
    expect(snapshot.name).toBe(plan.name);
    expect(snapshot.durationWeeks).toBe(plan.durationWeeks);

    const snapshotWorkouts = await prisma.workout.findMany({
      where: { trainingPlanId: snapshot.id },
      orderBy: { position: "asc" },
      include: { workoutExercises: { orderBy: { position: "asc" } } },
    });
    expect(snapshotWorkouts).toHaveLength(2);
    expect(snapshotWorkouts.map((w) => w.name)).toEqual([workoutA.name, workoutB.name]);
    expect(snapshotWorkouts[0]!.id).not.toBe(workoutA.id);
    expect(snapshotWorkouts[0]!.workoutExercises).toHaveLength(1);
    expect(snapshotWorkouts[0]!.workoutExercises[0]!.sets).toBe(3);
    expect(snapshotWorkouts[1]!.workoutExercises[0]!.sets).toBe(4);
  });

  it("editar o modelo/plano original depois da atribuição não altera o que foi atribuído", async () => {
    const { tenant, owner } = await createTenant("atribuir-imutavel");
    const student = await createStudent(tenant.id, "atribuir-imutavel");
    const { plan, workoutA } = await createPlanWithWorkoutsAndItems(tenant.id, "atribuir-imutavel");

    const assignment = await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: plan.id },
      prisma
    );

    await updateWorkout({ tenantId: tenant.id, workoutId: workoutA.id, name: `Alterado depois ${run}` }, prisma);
    await updateTrainingPlan({ tenantId: tenant.id, trainingPlanId: plan.id, name: `Plano alterado ${run}` }, prisma);

    const active = await getActivePlanAssignmentForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(active?.trainingPlan.name).not.toBe(`Plano alterado ${run}`);
    expect(active?.trainingPlan.workouts.map((w) => w.name)).not.toContain(`Alterado depois ${run}`);
  });

  it("rejeita aluno que não pertence ao tenant informado", async () => {
    const { tenant: tenantA, owner } = await createTenant("atribuir-aluno-cruzado-a");
    const { tenant: tenantB } = await createTenant("atribuir-aluno-cruzado-b");
    const studentB = await createStudent(tenantB.id, "atribuir-aluno-cruzado");
    const { plan } = await createPlanWithWorkoutsAndItems(tenantA.id, "atribuir-aluno-cruzado");

    await expect(
      assignTrainingPlanToStudent(
        { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentB.id, trainingPlanId: plan.id },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("rejeita plano que não pertence ao tenant informado", async () => {
    const { tenant: tenantA, owner } = await createTenant("atribuir-plano-cruzado-a");
    const { tenant: tenantB } = await createTenant("atribuir-plano-cruzado-b");
    const studentA = await createStudent(tenantA.id, "atribuir-plano-cruzado");
    const { plan: planB } = await createPlanWithWorkoutsAndItems(tenantB.id, "atribuir-plano-cruzado");

    await expect(
      assignTrainingPlanToStudent(
        { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentA.id, trainingPlanId: planB.id },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("encerra controladamente a atribuição ativa anterior ao atribuir um novo plano ao mesmo aluno", async () => {
    const { tenant, owner } = await createTenant("atribuir-substituir");
    const student = await createStudent(tenant.id, "atribuir-substituir");
    const { plan: planUm } = await createPlanWithWorkoutsAndItems(tenant.id, "atribuir-substituir-um");
    const { plan: planDois } = await createPlanWithWorkoutsAndItems(tenant.id, "atribuir-substituir-dois");

    const primeira = await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: planUm.id },
      prisma
    );
    const segunda = await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: planDois.id },
      prisma
    );

    const primeiraAtualizada = await prisma.planAssignment.findUniqueOrThrow({ where: { id: primeira.id } });
    expect(primeiraAtualizada.active).toBe(false);
    expect(primeiraAtualizada.endedAt).not.toBeNull();
    expect(segunda.active).toBe(true);

    const ativa = await getActivePlanAssignmentForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);
    expect(ativa?.id).toBe(segunda.id);
  });

  it("no máximo uma atribuição ativa por aluno é garantido fisicamente pelo índice único parcial", async () => {
    const { tenant } = await createTenant("atribuir-unicidade-fisica");
    const student = await createStudent(tenant.id, "atribuir-unicidade-fisica");
    const { plan } = await createPlanWithWorkoutsAndItems(tenant.id, "atribuir-unicidade-fisica");

    await prisma.planAssignment.create({
      data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id, active: true },
    });

    await expect(
      prisma.planAssignment.create({
        data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id, active: true },
      })
    ).rejects.toThrow();
  });
});

describe("unassignTrainingPlanFromStudent (FIT-033)", () => {
  it("encerra a atribuição ativa sem criar uma nova", async () => {
    const { tenant, owner } = await createTenant("encerrar");
    const student = await createStudent(tenant.id, "encerrar");
    const { plan } = await createPlanWithWorkoutsAndItems(tenant.id, "encerrar");
    await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: plan.id },
      prisma
    );

    const ended = await unassignTrainingPlanFromStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id },
      prisma
    );

    expect(ended?.active).toBe(false);
    expect(ended?.endedAt).not.toBeNull();
    const active = await getActivePlanAssignmentForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);
    expect(active).toBeNull();
  });

  it("é idempotente: sem atribuição ativa, retorna null e não lança", async () => {
    const { tenant, owner } = await createTenant("encerrar-sem-ativa");
    const student = await createStudent(tenant.id, "encerrar-sem-ativa");

    const result = await unassignTrainingPlanFromStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id },
      prisma
    );

    expect(result).toBeNull();
  });
});

describe("getActivePlanAssignmentForStudent / listEndedPlanAssignmentsForStudent (FIT-033)", () => {
  it("retorna null quando o aluno nunca teve plano atribuído (estado sem plano)", async () => {
    const { tenant } = await createTenant("sem-plano");
    const student = await createStudent(tenant.id, "sem-plano");

    const active = await getActivePlanAssignmentForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(active).toBeNull();
  });

  it("lista as atribuições encerradas do aluno, mais recente primeiro (estado plano encerrado)", async () => {
    const { tenant, owner } = await createTenant("historico-encerradas");
    const student = await createStudent(tenant.id, "historico-encerradas");
    const { plan: planUm } = await createPlanWithWorkoutsAndItems(tenant.id, "historico-encerradas-um");
    const { plan: planDois } = await createPlanWithWorkoutsAndItems(tenant.id, "historico-encerradas-dois");

    await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: planUm.id },
      prisma
    );
    await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: planDois.id },
      prisma
    );
    await unassignTrainingPlanFromStudent({ tenantId: tenant.id, actorUserId: owner.id, studentId: student.id }, prisma);

    const ended = await listEndedPlanAssignmentsForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(ended).toHaveLength(2);
    expect(ended[0]!.trainingPlan.name).toBe(planDois.name);
    expect(ended[1]!.trainingPlan.name).toBe(planUm.name);
    expect(ended.every((a) => a.active === false)).toBe(true);
  });

  it("isolamento: nunca retorna atribuição de aluno de outro tenant", async () => {
    const { tenant: tenantA, owner } = await createTenant("atribuicao-isolamento-a");
    const { tenant: tenantB } = await createTenant("atribuicao-isolamento-b");
    const studentA = await createStudent(tenantA.id, "atribuicao-isolamento");
    const { plan } = await createPlanWithWorkoutsAndItems(tenantA.id, "atribuicao-isolamento");
    await assignTrainingPlanToStudent(
      { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentA.id, trainingPlanId: plan.id },
      prisma
    );

    const seenFromOtherTenant = await getActivePlanAssignmentForStudent(
      { tenantId: tenantB.id, studentId: studentA.id },
      prisma
    );

    expect(seenFromOtherTenant).toBeNull();
  });
});
