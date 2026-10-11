// @vitest-environment node
//
// FIT-151 (EPIC-20): dados do Início do Aluno. PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { estimateMinutes, getStudentHome } from "./studentHome";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.assessment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("getStudentHome (FIT-151)", () => {
  it("treino do dia, descanso com próximo, em andamento e sem programa", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Joana", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${run}` } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `aluno-${run}@example.test`, displayName: "Pedro" } });
    const exercise = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino ${run}`, origin: "PERSONAL" } });

    const empty = await getStudentHome({ tenantId: tenant.id, studentId: student.id }, prisma);
    expect(empty.hero).toEqual({ kind: "noPlan", endedPlanName: null });
    expect(empty.program).toBeNull();

    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia", durationWeeks: 8, isSnapshot: false } });
    const a = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0, suggestedDays: ["SEGUNDA", "QUINTA"] } });
    await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino B", position: 1, suggestedDays: ["TERCA"] } });
    await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: a.id, exerciseId: exercise.id, position: 0, sets: 3, reps: 12, restSeconds: 60 } });
    await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id, assignedAt: new Date(2026, 8, 21, 9) } });
    await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: student.id, authorUserId: owner.id, weightGrams: 72400, bodyFatTenthPercent: 185 } });

    const monday = new Date(2026, 9, 5, 12);
    const today = await getStudentHome({ tenantId: tenant.id, studentId: student.id, now: monday }, prisma);
    expect(today.hero).toEqual({ kind: "today", workoutName: "Treino A", exercises: 1, estimatedMinutes: 5 });
    expect(today.program).toEqual({ name: "Hipertrofia", week: 3, weeks: 8 });
    expect(today.upcoming).toEqual([
      { dayLabel: "Amanhã", dayShort: "Ter", workoutName: "Treino B" },
      { dayLabel: "Quinta", dayShort: "Qui", workoutName: "Treino A" },
      { dayLabel: "Segunda", dayShort: "Seg", workoutName: "Treino A" },
    ]);
    expect(today.week.planned.sort()).toEqual(["QUINTA", "SEGUNDA", "TERCA"]);
    expect(today.lastAssessment).toMatchObject({ weightKg: 72.4, bodyFatPercent: 18.5 });

    const wednesday = await getStudentHome({ tenantId: tenant.id, studentId: student.id, now: new Date(2026, 9, 7, 12) }, prisma);
    expect(wednesday.hero).toEqual({ kind: "rest", next: { dayLabel: "Amanhã", dayShort: "Qui", workoutName: "Treino A" } });

    await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: a.id, startedAt: new Date(monday.getTime() - 20 * 60_000) } });
    const live = await getStudentHome({ tenantId: tenant.id, studentId: student.id, now: monday }, prisma);
    expect(live.hero).toEqual({ kind: "progress", workoutName: "Treino A", done: 0, total: 1, minutesAgo: 20 });
  });

  it("estima a duração em blocos de 5 min", () => {
    expect(estimateMinutes([{ sets: 4, durationSeconds: null, restSeconds: 90 }, { sets: 3, durationSeconds: 45, restSeconds: null }])).toBe(15);
  });
});
