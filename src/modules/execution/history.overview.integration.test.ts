// @vitest-environment node
//
// FIT-159 (EPIC-21): treinos na semana, no mês e semanas seguidas.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getTrainingOverviewForStudent } from "./history";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("getTrainingOverviewForStudent (FIT-159)", () => {
  it("conta semana, mês e semanas seguidas (a atual só entra se já tiver treino)", async () => {
    const user = await prisma.user.create({ data: { email: `o-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Livre ${run}`, type: "INDIVIDUAL" } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `s-${run}@example.test`, displayName: "Rafa", userId: user.id } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
    const done = (date: Date, status: "CONCLUIDA" | "ABANDONADA" = "CONCLUIDA") => prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, status, startedAt: date, endedAt: date } });

    // Quarta, 14/10/2026. Semanas com treino: 05/10, 28/09, 21/09; buraco em 14/09; 07/09.
    const now = new Date(2026, 9, 14, 12);
    await done(new Date(2026, 9, 6, 8));
    await done(new Date(2026, 9, 7, 8));
    await done(new Date(2026, 8, 30, 8));
    await done(new Date(2026, 8, 22, 8));
    await done(new Date(2026, 8, 8, 8));
    await done(new Date(2026, 9, 13, 8), "ABANDONADA");

    expect(await getTrainingOverviewForStudent({ tenantId: tenant.id, studentId: student.id, now }, prisma)).toEqual({ thisWeek: 0, thisMonth: 2, streakWeeks: 3 });
    await done(new Date(2026, 9, 12, 8));
    expect(await getTrainingOverviewForStudent({ tenantId: tenant.id, studentId: student.id, now }, prisma)).toEqual({ thisWeek: 1, thisMonth: 3, streakWeeks: 4 });
  });
});
