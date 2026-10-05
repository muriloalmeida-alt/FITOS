// @vitest-environment node
//
// FIT-144 (EPIC-19): carteira de alunos com filtros "Precisam de você" e
// "Convites" (BK-07) e aderência da semana (BK-06). PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { listStudentRoster, weeklyCompletionRate } from "./roster";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.invitation.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("listStudentRoster (FIT-144)", () => {
  it("classifica atenção, convites e inativos, conta por filtro e calcula a semana", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant roster ${run}` } });
    const { tenant: other } = { tenant: await prisma.tenant.create({ data: { ownerId: (await prisma.user.create({ data: { email: `outro-${run}@example.test`, name: "Outro", role: "PERSONAL" } })).id, name: `Outro roster ${run}` } }) };
    const mk = (name: string, extra: Record<string, unknown> = {}) => prisma.student.create({ data: { tenantId: tenant.id, email: `${name}-${run}@example.test`, displayName: name, ...extra } });

    const anaUser = await prisma.user.create({ data: { email: `ana-user-${run}@example.test`, name: "Ana", role: "ALUNO" } });
    const ana = await mk("Ana", { userId: anaUser.id });
    const pedro = await mk("Pedro");
    const bruno = await mk("Bruno");
    await mk("Julia", { status: "INATIVO" });
    await prisma.student.create({ data: { tenantId: other.id, email: `alheio-${run}@example.test`, displayName: "Alheio" } });

    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia", durationWeeks: 8, isSnapshot: false } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0, suggestedDays: ["SEGUNDA", "QUARTA"] } });
    const now = new Date(2026, 9, 8, 12);
    await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: ana.id, trainingPlanId: plan.id, assignedAt: new Date(2026, 8, 20) } });
    await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: ana.id, workoutId: workout.id, status: "CONCLUIDA", startedAt: new Date(2026, 9, 5, 18) } });
    await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: bruno.id, trainingPlanId: plan.id } });
    await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: bruno.id, description: "Mensalidade", amountCents: 18000, referenceMonth: new Date(2026, 9, 1), dueDate: new Date(2020, 0, 1) } });
    await prisma.invitation.create({ data: { tenantId: tenant.id, studentId: pedro.id, tokenHash: `hash-${run}`, expiresAt: new Date(2020, 0, 1) } });

    const result = await listStudentRoster({ tenantId: tenant.id, filter: "ativos", now }, prisma);
    expect(result.counts).toEqual({ ativos: 3, atencao: 2, convites: 2, inativos: 1, todos: 4 });
    const byName = Object.fromEntries(result.rows.map((row) => [row.displayName, row]));
    expect(byName.Ana).toMatchObject({ accessStatus: "CONTA_ATIVA", activePlanName: "Hipertrofia", planWeek: 3, planWeeks: 8, weekDone: 1, weekTarget: 2, needsAttention: false });
    expect(byName.Pedro).toMatchObject({ accessStatus: "CONVITE_EXPIRADO", activePlanName: null, needsAttention: true });
    expect(byName.Bruno).toMatchObject({ hasOverdueCharge: true, needsAttention: true });

    const atencao = await listStudentRoster({ tenantId: tenant.id, filter: "atencao", now }, prisma);
    expect(atencao.rows.map((row) => row.displayName)).toEqual(["Bruno", "Pedro"]);
    const busca = await listStudentRoster({ tenantId: tenant.id, filter: "todos", search: "julia", now }, prisma);
    expect(busca.rows.map((row) => row.displayName)).toEqual(["Julia"]);
    expect(weeklyCompletionRate(result.rows)).toBe(25);
  });
});
