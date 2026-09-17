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
  archiveWorkout,
  createWorkout,
  duplicateWorkout,
  getWorkoutExerciseForTenant,
  getWorkoutForTenant,
  listWorkoutExercisesForWorkout,
  listWorkoutsForTenant,
  reactivateWorkout,
  removeWorkoutExercise,
  reorderWorkoutExercises,
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
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
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
