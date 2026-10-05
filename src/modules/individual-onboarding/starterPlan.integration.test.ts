// @vitest-environment node
//
// Plano inicial do FitOS Livre (EPIC-30) contra PostgreSQL real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { createStarterPlanForIndividual, pickStarterWorkouts } from "./starterPlan";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
});

afterAll(async () => {
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("plano inicial do FitOS Livre (EPIC-30)", () => {
  it("escolhe os treinos pelas respostas", () => {
    expect(pickStarterWorkouts({ objective: "GANHAR_MASSA", availability: "TRES_A_QUATRO_DIAS", experience: "INTERMEDIARIO" }).map((w) => w.name)).toEqual(["Inferiores A", "Superiores A", "Inferiores B", "Superiores B"]);
    expect(pickStarterWorkouts({ objective: "PERDER_PESO", availability: "UM_A_DOIS_DIAS", experience: "INICIANTE" }).map((w) => w.days)).toEqual([["SEGUNDA"], ["QUINTA"]]);
    const five = pickStarterWorkouts({ objective: "PERDER_PESO", availability: "CINCO_OU_MAIS_DIAS", experience: "AVANCADO" });
    expect(five.at(-1)).toMatchObject({ name: "HIIT na bike", days: ["QUARTA", "SABADO"] });
  });

  it("cria os treinos com dias num espaço vazio e nunca duplica", async () => {
    const owner = await prisma.user.create({ data: { email: `livre-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Livre ${run}`, type: "INDIVIDUAL" } });
    const input = { tenantId: tenant.id, objective: "PERDER_PESO" as const, availability: "TRES_A_QUATRO_DIAS" as const, experience: "INICIANTE" as const };

    expect(await createStarterPlanForIndividual(input, prisma)).toEqual({ created: 4 });
    const workouts = await prisma.workout.findMany({ where: { tenantId: tenant.id }, include: { workoutExercises: true }, orderBy: { position: "asc" } });
    expect(workouts.map((w) => [w.name, w.suggestedDays])).toEqual([
      ["Corpo todo A", ["SEGUNDA"]],
      ["Caminhada inclinada", ["TERCA"]],
      ["Corpo todo B", ["QUARTA"]],
      ["Bike leve", ["SEXTA"]],
    ]);
    expect(workouts[0]!.workoutExercises.length).toBeGreaterThanOrEqual(4);
    expect(workouts[0]!.workoutExercises.every((item) => item.sets === 3)).toBe(true);
    expect(workouts[1]!.workoutExercises[0]).toMatchObject({ durationSeconds: 1800, intensity: "MODERADO" });

    expect(await createStarterPlanForIndividual(input, prisma)).toEqual({ created: 0 });
  });
});
