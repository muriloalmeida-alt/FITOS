// @vitest-environment node
//
// Conquistas (Desafios) contra PostgreSQL real: meta congelada no período,
// só pontos oficiais contam, estorno revisa a medalha e a galeria guarda
// as semanas encerradas.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { getAchievements } from "./achievements";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = new Date("2026-10-09T15:00:00Z"); // sexta, semana de 05/10

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function setup(preferredDays: string[]) {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  await prisma.student.update({ where: { id: student.id }, data: { preferredDays } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
  return { scope: { tenantId: tenant.id, studentId: student.id }, workoutId: workout.id };
}

/// Treino concluído com pontuação pronta (o cálculo em si tem teste próprio).
async function scored(ctx: Awaited<ReturnType<typeof setup>>, performedAt: string, totalTenths: number, status: "LIBERADO" | "PENDENTE_FOTO" = "LIBERADO", plannedItems = 6) {
  const at = new Date(performedAt);
  const session = await prisma.workoutSession.create({ data: { ...ctx.scope, workoutId: ctx.workoutId, status: "CONCLUIDA", startedAt: at, endedAt: at } });
  return prisma.sessionScore.create({
    data: { ...ctx.scope, sessionId: session.id, ruleVersion: 1, totalTenths, plannedItems, balancedTenths: Math.round(totalTenths / plannedItems), items: [], status, performedAt: at, photoDeadline: new Date(at.getTime() + 3 * 86_400_000) },
  });
}

describe("conquistas", () => {
  it("meta da semana = 10 × 3 dias × 6 exercícios (180); Prata com 135, faltam 45 para Ouro; pendente de foto não conta", async () => {
    const ctx = await setup(["SEGUNDA", "QUARTA", "SEXTA"]);
    // Histórico para a mediana de exercícios por treino (6).
    await scored(ctx, "2026-09-21T12:00:00Z", 600);
    await scored(ctx, "2026-09-23T12:00:00Z", 600);
    await scored(ctx, "2026-10-05T12:00:00Z", 700);
    await scored(ctx, "2026-10-07T12:00:00Z", 650);
    await scored(ctx, "2026-10-08T12:00:00Z", 500, "PENDENTE_FOTO");

    const achievements = await getAchievements(ctx.scope, prisma, now);
    expect(achievements.week).toMatchObject({ key: "2026-10-05", goalTenths: 1800, pointsTenths: 1350, medal: "PRATA", next: { label: "Ouro", missingTenths: 450 }, plannedDays: 3, itemsPerWorkout: 6 });
    expect(achievements.pendingPhotos).toBe(1);
    // Galeria: sem histórico antes de 21/09, a meta daquela semana é 150
    // (5 exercícios); 120 pontos = 80% → Prata.
    expect(achievements.weeks.map((week) => [week.key, week.goalTenths, week.medal])).toEqual([["2026-09-21", 1500, "PRATA"]]);
    expect(achievements.month).toMatchObject({ key: "2026-10", goalTenths: 13 * 6 * 100, pointsTenths: 1350 });
  });

  it("meta congelada: mudar os dias não muda a meta da semana; estorno revisa a medalha", async () => {
    const ctx = await setup(["SEGUNDA", "QUARTA", "SEXTA"]);
    const score = await scored(ctx, "2026-10-06T12:00:00Z", 800, "LIBERADO", 5);
    const first = await getAchievements(ctx.scope, prisma, now);
    expect(first.week).toMatchObject({ goalTenths: 1500, medal: "BRONZE" });

    await prisma.student.update({ where: { id: ctx.scope.studentId }, data: { preferredDays: ["SEGUNDA"] } });
    await prisma.sessionScore.update({ where: { id: score.id }, data: { status: "PENDENTE_FOTO" } });
    const after = await getAchievements(ctx.scope, prisma, now);
    expect(after.week).toMatchObject({ goalTenths: 1500, pointsTenths: 0, medal: null, next: { label: "Bronze", missingTenths: 750 } });
    expect(await prisma.periodGoal.count({ where: { studentId: ctx.scope.studentId, periodType: "SEMANA" } })).toBe(1);
  });

  it("sem dias e sem histórico: 3 treinos × 5 exercícios = 150 por semana", async () => {
    const ctx = await setup([]);
    // Como a página chama: com o contexto inteiro de quem treina.
    const self = { ...ctx.scope, userId: "u", role: "INDIVIDUAL" as const };
    expect((await getAchievements(self, prisma, now)).week).toMatchObject({ goalTenths: 1500, pointsTenths: 0, medal: null });
  });
});
