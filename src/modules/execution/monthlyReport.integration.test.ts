// @vitest-environment node
//
// Relatório do mês (EPIC-45) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getMonthlyReport, monthLabel, parseMonth, shiftMonth } from "./monthlyReport";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.workoutSetResult.deleteMany({ where });
  await prisma.workoutSession.deleteMany({ where });
  await prisma.workoutExercise.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.assessment.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("relatório do mês (EPIC-45)", () => {
  it("mês: padrão, deslocamento e rótulo", () => {
    expect(parseMonth("2026-09")).toBe("2026-09");
    expect(parseMonth("2026-13", new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-09")).toBe("Setembro de 2026");
  });

  it("números do mês, comparação, recordes, cargas e corpo", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `ana-${run}@example.test`, displayName: "Ana" } });
    const supino = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino ${run}`, origin: "PERSONAL" } });
    const remada = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Remada ${run}`, origin: "PERSONAL" } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia" } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
    const supinoItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: supino.id, position: 0, sets: 2, reps: 10 } });
    const remadaItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: remada.id, position: 1, sets: 2, reps: 10 } });
    const train = async (iso: string, supinoKg: number, remadaKg: number) => {
      const at = new Date(iso);
      const session = await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, status: "CONCLUIDA", startedAt: at, endedAt: new Date(at.getTime() + 3_600_000), activeSeconds: 2700 } });
      for (const setNumber of [1, 2]) {
        await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: supinoItem.id, setNumber, reps: 10, loadGrams: supinoKg * 1000 } });
        await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: remadaItem.id, setNumber, reps: 10, loadGrams: remadaKg * 1000 } });
      }
    };
    await train("2026-08-20T12:00:00Z", 40, 35);
    await train("2026-09-02T12:00:00Z", 40, 30);
    await train("2026-09-15T12:00:00Z", 45, 32.5);
    // 30/09 às 23h em Brasília ainda é setembro; 01/10 01h, não.
    await train("2026-10-01T02:00:00Z", 47.5, 32.5);
    await train("2026-10-01T04:00:00Z", 50, 50);
    await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: student.id, authorUserId: owner.id, weightGrams: 82000, bodyFatTenthPercent: 220, recordedAt: new Date("2026-08-25T12:00:00Z") } });
    await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: student.id, authorUserId: owner.id, weightGrams: 80500, bodyFatTenthPercent: 205, recordedAt: new Date("2026-09-28T12:00:00Z") } });

    const report = await getMonthlyReport({ tenantId: tenant.id, studentId: student.id, month: "2026-09" }, prisma);
    expect(report).toMatchObject({ label: "Setembro de 2026", sessions: 3, days: 3, activeMinutes: 135, sets: 12, previous: { sessions: 1 }, firstMonth: "2026-08" });
    // Volume: (40+30)*20 + (45+32,5)*20 + (47,5+32,5)*20 = 1400 + 1550 + 1600.
    expect(report.volumeKg).toBe(4550);
    expect(report.records).toEqual([{ exerciseName: `Supino ${run}`, loadKg: 47.5 }]);
    expect(report.gains).toEqual([
      { exerciseName: `Supino ${run}`, fromKg: 40, toKg: 47.5 },
      { exerciseName: `Remada ${run}`, fromKg: 30, toKg: 32.5 },
    ]);
    expect(report.body).toEqual({ weightFrom: 82, weightTo: 80.5, fatFrom: 22, fatTo: 20.5 });

    const empty = await getMonthlyReport({ tenantId: tenant.id, studentId: student.id, month: "2026-07" }, prisma);
    expect(empty).toMatchObject({ sessions: 0, volumeKg: 0, records: [], body: null, photos: [] });
  });
});
