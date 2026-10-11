// @vitest-environment node
//
// Prescrição padrão do espaço (Configurações, EPIC-36) contra PostgreSQL
// real: exercícios novos entram com o que o personal escolheu.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { addWorkoutExercisesBatch, ensureDraftTrainingPlanForTenant, getTenantPrescription, setTenantPrescription } from "./workouts";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
}, 60_000);

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.workoutExercise.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("prescrição padrão do espaço (EPIC-36)", () => {
  it("começa em 3 × 12 com 60 s, muda com validação e vale para os próximos exercícios", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    expect(await getTenantPrescription(tenant.id, prisma)).toEqual({ sets: 3, reps: 12, restSeconds: 60 });

    await expect(setTenantPrescription({ tenantId: tenant.id, sets: 0, reps: 10, restSeconds: 90 }, prisma)).rejects.toThrow("Séries de 1 a 10.");
    await expect(setTenantPrescription({ tenantId: tenant.id, sets: 4, reps: 10, restSeconds: 900 }, prisma)).rejects.toThrow("Descanso de 0 a 300 s.");
    expect(await setTenantPrescription({ tenantId: tenant.id, sets: 4, reps: 10, restSeconds: 90 }, prisma)).toEqual({ sets: 4, reps: 10, restSeconds: 90 });

    const plan = await ensureDraftTrainingPlanForTenant(tenant.id, prisma);
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Peito", position: 0 } });
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { externalId: "fitos:supino-reto-com-barra", tenantId: null } });
    const [item] = await addWorkoutExercisesBatch({ tenantId: tenant.id, workoutId: workout.id, exerciseIds: [exercise.id] }, prisma);
    expect(item).toMatchObject({ sets: 4, reps: 10, restSeconds: 90 });
  });
});
