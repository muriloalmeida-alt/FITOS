// @vitest-environment node
//
// Sugestão de progressão (EPIC-30) contra PostgreSQL real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { suggestProgressions } from "./progression";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
});

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.workoutSetResult.deleteMany({ where });
  await prisma.workoutSession.deleteMany({ where });
  await prisma.workoutExercise.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: owner.id, email: owner.email, displayName: "Rafa" } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Meus treinos", isDraftBucket: true } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Superiores A", position: 0 } });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { externalId: "fitos:puxada-alta-pegada-aberta" } });
  const item = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, position: 0, sets: 3, reps: 12, load: "40 kg" } });
  async function session(daysAgo: number, reps: number[], loadKg: number, effort: number | null) {
    const startedAt = new Date(Date.now() - daysAgo * 86_400_000);
    const s = await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, status: "CONCLUIDA", startedAt, endedAt: startedAt, perceivedEffort: effort } });
    for (const [index, value] of reps.entries()) {
      await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: s.id, workoutExerciseId: item.id, setNumber: index + 1, reps: value, loadGrams: loadKg * 1000 } });
    }
  }
  return { tenant, student, item, workout, session };
}

describe("suggestProgressions (EPIC-30)", () => {
  it("sugere +2,5 kg depois de duas vezes completas e tranquilas", async () => {
    const { tenant, student, item, workout, session } = await setup("sobe");
    await session(6, [12, 12, 12], 40, 3);
    await session(2, [12, 12, 13], 40, null);
    expect(await suggestProgressions({ tenantId: tenant.id, studentId: student.id }, prisma)).toEqual([
      { workoutId: workout.id, itemId: item.id, workoutName: "Superiores A", exerciseName: expect.any(String), fromKg: 40, toKg: 42.5, reps: 12 },
    ]);
  });

  it("não sugere se faltou repetição ou o treino foi pesado", async () => {
    const a = await setup("faltou");
    await a.session(6, [12, 12, 12], 40, 2);
    await a.session(2, [12, 11, 10], 40, 2);
    expect(await suggestProgressions({ tenantId: a.tenant.id, studentId: a.student.id }, prisma)).toEqual([]);

    const b = await setup("pesado");
    await b.session(6, [12, 12, 12], 40, 2);
    await b.session(2, [12, 12, 12], 40, 5);
    expect(await suggestProgressions({ tenantId: b.tenant.id, studentId: b.student.id }, prisma)).toEqual([]);
  });
});
