// @vitest-environment node
//
// FIT-156 (EPIC-21): Início do FitOS Livre — "Hoje para você" pelos dias
// sugeridos (BK-16) ou rodízio, semana contra a meta do perfil.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getIndividualHome } from "./individualHome";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.goal.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.individualProfile.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("getIndividualHome (FIT-156, BK-16)", () => {
  it("treino do dia pelos dias sugeridos; sem dia, o feito há mais tempo; semana e metas", async () => {
    const user = await prisma.user.create({ data: { email: `livre-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Livre ${run}`, type: "INDIVIDUAL" } });
    await prisma.individualProfile.create({ data: { tenantId: tenant.id, objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS" } });
    const exercise = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Remada ${run}`, origin: "PERSONAL" } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Meus treinos", isSnapshot: false } });
    const mk = async (name: string, days: string[], items = 1) => {
      const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name, position: 0, suggestedDays: days } });
      for (let index = 0; index < items; index += 1) await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, position: index, sets: 3, reps: 12, restSeconds: 60 } });
      return workout;
    };
    const a = await mk("A", ["SEGUNDA"]);
    const b = await mk("B", []);
    await mk("Vazio", ["QUARTA"], 0);

    const monday = new Date(2026, 9, 5, 9);
    const wednesday = new Date(2026, 9, 7, 9);
    const noSelf = await getIndividualHome({ tenantId: tenant.id, userId: user.id, now: monday }, prisma);
    expect(noSelf.today).toMatchObject({ id: a.id, reason: "dia" });
    expect(noSelf.week.target).toBe(4);

    const self = await prisma.student.create({ data: { tenantId: tenant.id, email: `self-${run}@example.test`, displayName: "Rafa", userId: user.id } });
    await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: self.id, workoutId: a.id, status: "CONCLUIDA", startedAt: new Date(2026, 9, 5, 7), endedAt: new Date(2026, 9, 5, 8) } });
    await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: self.id, workoutId: b.id, status: "CONCLUIDA", startedAt: new Date(2026, 8, 20, 7), endedAt: new Date(2026, 8, 20, 8) } });
    await prisma.goal.create({ data: { tenantId: tenant.id, studentId: self.id, description: "Correr 5 km" } });

    // Quarta: o único com dia é o vazio (ignorado) → rodízio pega o feito há mais tempo (B).
    const home = await getIndividualHome({ tenantId: tenant.id, userId: user.id, now: wednesday }, prisma);
    expect(home.today).toMatchObject({ id: b.id, reason: "rodizio" });
    expect(home.week).toMatchObject({ doneCount: 1, target: 4 });
    expect(home.week.done[0]).toBe(true);
    expect(home.activeGoals).toBe(1);
    expect(home.workouts.map((workout) => workout.name)).toEqual(["A", "B", "Vazio"]);
  });
});
