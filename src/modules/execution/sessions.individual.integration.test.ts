// @vitest-environment node
//
// Testes de integração da execução de treino individual (FIT-103) contra
// PostgreSQL real (banco de testes). Complementa
// `sessions.integration.test.ts` (personal/aluno) cobrindo o caminho de
// validação diferente de `startOrResumeIndividualWorkoutSession`: posse
// direta do treino (tenant + ATIVO), nunca uma atribuição.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { addWorkoutExercise, archiveWorkout, createWorkout } from "@/modules/workouts/workouts";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import {
  abandonWorkoutSession,
  completeWorkoutSession,
  getInProgressSessionForStudent,
  recordSessionResult,
  SessionError,
  startOrResumeIndividualWorkoutSession,
} from "./sessions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.workoutSessionResult.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
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

describe("startOrResumeIndividualWorkoutSession (FIT-103)", () => {
  it("inicia uma sessão para um treino ATIVO do próprio tenant, sem nenhuma atribuição", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("normal");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);

    const session = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );

    expect(session.workoutId).toBe(workout.id);
    expect(session.status).toBe("EM_ANDAMENTO");
  });

  it("retoma a mesma sessão ao chamar de novo para o mesmo treino", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("retomar");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);

    const first = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );
    const second = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );

    expect(second.id).toBe(first.id);
  });

  it("iniciar outro treino abandona automaticamente a sessão em andamento anterior", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("trocar");
    const workoutA = await createWorkout({ tenantId: tenant.id, name: `Treino A ${run}` }, prisma);
    const workoutB = await createWorkout({ tenantId: tenant.id, name: `Treino B ${run}` }, prisma);

    const sessionA = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workoutA.id },
      prisma
    );
    const sessionB = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workoutB.id },
      prisma
    );

    const reloadedA = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionA.id } });
    expect(reloadedA.status).toBe("ABANDONADA");
    expect(sessionB.status).toBe("EM_ANDAMENTO");
  });

  it("rejeita um treino arquivado", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("arquivado");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);
    await archiveWorkout({ tenantId: tenant.id, workoutId: workout.id }, prisma);

    await expect(
      startOrResumeIndividualWorkoutSession({ tenantId: tenant.id, studentId: student.id, workoutId: workout.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("rejeita um treino de outro tenant", async () => {
    const { tenant: tenantA, student: studentA } = await createIndividualTenantWithStudent("tenant-a");
    const { tenant: tenantB } = await createIndividualTenantWithStudent("tenant-b");
    const workoutB = await createWorkout({ tenantId: tenantB.id, name: `Treino B ${run}` }, prisma);

    await expect(
      startOrResumeIndividualWorkoutSession({ tenantId: tenantA.id, studentId: studentA.id, workoutId: workoutB.id }, prisma)
    ).rejects.toBeInstanceOf(SessionError);
  });

  it("fluxo completo: iniciar, registrar resultado e concluir, reaproveitando o motor do FIT-041 sem alteração", async () => {
    const { tenant, student } = await createIndividualTenantWithStudent("fluxo-completo");
    const exercise = await createGlobalExercise("fluxo-completo");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino ${run}` }, prisma);
    const item = await addWorkoutExercise(
      { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, sets: 3, reps: 10 },
      prisma
    );

    const session = await startOrResumeIndividualWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: workout.id },
      prisma
    );

    const result = await recordSessionResult(
      {
        tenantId: tenant.id,
        studentId: student.id,
        sessionId: session.id,
        workoutExerciseId: item.id,
        setsCompleted: 3,
        repsCompleted: 12,
        durationSecondsCompleted: null,
        loadUsed: "20kg",
      },
      prisma
    );
    expect(result.repsCompleted).toBe(12);

    const completed = await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);
    expect(completed.status).toBe("CONCLUIDA");

    expect(await getInProgressSessionForStudent({ tenantId: tenant.id, studentId: student.id }, prisma)).toBeNull();

    await expect(
      abandonWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });
});
