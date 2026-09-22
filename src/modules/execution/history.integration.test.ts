// @vitest-environment node
//
// Testes de integração de histórico, frequência e recordes de execução
// (FIT-104) contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { addWorkoutExercise, createWorkout } from "@/modules/workouts/workouts";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import {
  abandonWorkoutSession,
  completeWorkoutSession,
  recordSessionResult,
  startOrResumeIndividualWorkoutSession,
} from "./sessions";
import { getFrequencySummaryForStudent, listPersonalRecordsForStudent, listSessionHistoryForStudent } from "./history";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.workoutSessionResult.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createIndividualTenantWithStudent(label: string) {
  const owner = await prisma.user.create({
    data: { email: `praticante-${label}-${run}@example.test`, name: `Praticante ${label}`, role: "INDIVIDUAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  return { owner, tenant, student };
}

async function createGlobalExercise(label: string) {
  return prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `Global ${label} ${run}` } });
}

describe("listSessionHistoryForStudent (FIT-104)", () => {
  it("lista sessões concluídas e abandonadas, mais recente primeiro, nunca a EM_ANDAMENTO", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("historico");
    const workoutA = await createWorkout({ tenantId: tenant.id, name: `Treino A ${run}` }, prisma);
    const workoutB = await createWorkout({ tenantId: tenant.id, name: `Treino B ${run}` }, prisma);
    const workoutC = await createWorkout({ tenantId: tenant.id, name: `Treino C ${run}` }, prisma);

    const sessionA = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workoutA.id },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: sessionA.id }, prisma);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const sessionB = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workoutB.id },
      prisma
    );
    await abandonWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: sessionB.id }, prisma);

    // Sessão em andamento — nunca deve aparecer no histórico.
    await startOrResumeIndividualWorkoutSession({ tenantId: tenant.id, studentId: student.id, workoutId: workoutC.id }, prisma);

    const historico = await listSessionHistoryForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(historico.map((h) => h.id)).toEqual([sessionB.id, sessionA.id]);
    expect(historico[0]!.status).toBe("ABANDONADA");
    expect(historico[0]!.workoutName).toBe(workoutB.name);
    expect(historico[1]!.status).toBe("CONCLUIDA");
  });

  it("isolamento: nunca lista histórico de aluno de outro tenant", async () => {
    const { tenant: tenantA, student: studentA } = await createIndividualTenantWithStudent("isolamento-a");
    const { tenant: tenantB } = await createIndividualTenantWithStudent("isolamento-b");
    const workout = await createWorkout({ tenantId: tenantA.id, name: `Treino ${run}` }, prisma);
    const session = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenantA.id, studentId: studentA.id, workoutId: workout.id },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenantA.id, studentId: studentA.id, sessionId: session.id }, prisma);

    const historicoDeOutroTenant = await listSessionHistoryForStudent({ tenantId: tenantB.id, studentId: studentA.id }, prisma);
    expect(historicoDeOutroTenant).toHaveLength(0);
  });
});

describe("getFrequencySummaryForStudent (FIT-104)", () => {
  it("conta sessões CONCLUIDA nas janelas de 7 e 30 dias, por endedAt", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("frequencia");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);

    async function createConcludedSessionEndedAt(daysAgo: number) {
      const session = await startOrResumeIndividualWorkoutSession(
        { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
        prisma
      );
      const endedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      await prisma.workoutSession.update({ where: { id: session.id }, data: { status: "CONCLUIDA", endedAt } });
    }

    await createConcludedSessionEndedAt(1);
    await createConcludedSessionEndedAt(6);
    await createConcludedSessionEndedAt(20);
    await createConcludedSessionEndedAt(60);

    const summary = await getFrequencySummaryForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(summary.totalConcluded).toBe(4);
    expect(summary.last7Days).toBe(2);
    expect(summary.last30Days).toBe(3);
  });
});

describe("listPersonalRecordsForStudent (FIT-104)", () => {
  it("mantém a melhor carga numérica por exercício, ignorando cargas não numéricas e sessões não concluídas", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("recordes");
    const exerciseA = await createGlobalExercise("supino");
    const exerciseB = await createGlobalExercise("agachamento");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);
    const itemA = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseA.id, sets: 3, reps: 10 }, prisma);
    const itemB = await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exerciseB.id, sets: 3, reps: 8 }, prisma);

    // Sessão 1: 20kg no supino, carga não numérica no agachamento.
    const session1 = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );
    await recordSessionResult(
      { tenantId: tenant.id, studentId: student.id, sessionId: session1.id, workoutExerciseId: itemA.id, setsCompleted: 3, repsCompleted: 10, durationSecondsCompleted: null, loadUsed: "20kg" },
      prisma
    );
    await recordSessionResult(
      { tenantId: tenant.id, studentId: student.id, sessionId: session1.id, workoutExerciseId: itemB.id, setsCompleted: 3, repsCompleted: 8, durationSecondsCompleted: null, loadUsed: "peso corporal" },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session1.id }, prisma);

    // Sessão 2: 25kg no supino (novo recorde), sessão fica ABANDONADA — não deve contar.
    const session2 = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );
    await recordSessionResult(
      { tenantId: tenant.id, studentId: student.id, sessionId: session2.id, workoutExerciseId: itemA.id, setsCompleted: 3, repsCompleted: 6, durationSecondsCompleted: null, loadUsed: "30kg" },
      prisma
    );
    await abandonWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session2.id }, prisma);

    // Sessão 3: 22,5kg no supino (concluída, mas menor que 20kg da sessão 1? não — maior).
    const session3 = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );
    await recordSessionResult(
      { tenantId: tenant.id, studentId: student.id, sessionId: session3.id, workoutExerciseId: itemA.id, setsCompleted: 3, repsCompleted: 9, durationSecondsCompleted: null, loadUsed: "22,5kg" },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session3.id }, prisma);

    const recordes = await listPersonalRecordsForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(recordes).toHaveLength(1);
    expect(recordes[0]!.exerciseName).toBe(exerciseA.name);
    expect(recordes[0]!.loadValue).toBe(22.5);
    expect(recordes[0]!.loadUsed).toBe("22,5kg");
    expect(recordes[0]!.repsCompleted).toBe(9);
  });

  it("isolamento: nunca inclui recorde de aluno de outro tenant", async () => {
    const { tenant: tenantA, student: studentA } = await createIndividualTenantWithStudent("recordes-isolamento-a");
    const { tenant: tenantB } = await createIndividualTenantWithStudent("recordes-isolamento-b");
    const exercise = await createGlobalExercise("recordes-isolamento");
    const workout = await createWorkout({ tenantId: tenantA.id, name: `Treino ${run}` }, prisma);
    const item = await addWorkoutExercise({ tenantId: tenantA.id, workoutId: workout.id, exerciseId: exercise.id, sets: 3, reps: 10 }, prisma);
    const session = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenantA.id, studentId: studentA.id, workoutId: workout.id },
      prisma
    );
    await recordSessionResult(
      { tenantId: tenantA.id, studentId: studentA.id, sessionId: session.id, workoutExerciseId: item.id, setsCompleted: 3, repsCompleted: 10, durationSecondsCompleted: null, loadUsed: "40kg" },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenantA.id, studentId: studentA.id, sessionId: session.id }, prisma);

    const recordesDeOutroTenant = await listPersonalRecordsForStudent({ tenantId: tenantB.id, studentId: studentA.id }, prisma);
    expect(recordesDeOutroTenant).toHaveLength(0);
  });
});
