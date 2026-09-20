// @vitest-environment node
//
// Testes de integração da execução de sessão de treino (FIT-041) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  addWorkoutExercise,
  assignTrainingPlanToStudent,
  createTrainingPlan,
  createWorkout,
  moveWorkoutToPlan,
} from "@/modules/workouts/workouts";
import {
  abandonWorkoutSession,
  completeWorkoutSession,
  getInProgressSessionForStudent,
  getSessionForStudent,
  recordSessionResult,
  SessionError,
  startOrResumeWorkoutSession,
} from "./sessions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  // Mesma técnica já usada em workouts.integration.test.ts: o TRIGGER de
  // imutabilidade de snapshot (ADR-005) rejeita fisicamente qualquer
  // DELETE em workouts/workout_exercises de um plano isSnapshot=true —
  // inclusive via cascade a partir do tenant.
  await prisma.workoutSessionResult.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function createGlobalExercise(label: string) {
  return prisma.exercise.create({
    data: { tenantId: null, origin: "API_NINJAS", name: `Global ${label} ${run}` },
  });
}

async function createStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
}

/// Cria um aluno com um plano ativo de dois modelos (um item cada) — setup
/// padrão para os testes de sessão.
async function createAssignedStudent(label: string) {
  const { tenant, owner } = await createTenant(label);
  const student = await createStudent(tenant.id, label);
  const exerciseA = await createGlobalExercise(`${label}-ex-a`);
  const exerciseB = await createGlobalExercise(`${label}-ex-b`);
  const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano ${label} ${run}` }, prisma);

  const workoutA = await createWorkout({ tenantId: tenant.id, name: `Treino A ${label} ${run}` }, prisma);
  await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workoutA.id, targetTrainingPlanId: plan.id }, prisma);
  const itemA = await addWorkoutExercise(
    { tenantId: tenant.id, workoutId: workoutA.id, exerciseId: exerciseA.id, sets: 3, reps: 10 },
    prisma
  );

  const workoutB = await createWorkout({ tenantId: tenant.id, name: `Treino B ${label} ${run}` }, prisma);
  await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workoutB.id, targetTrainingPlanId: plan.id }, prisma);

  const assignment = await assignTrainingPlanToStudent(
    { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: plan.id },
    prisma
  );
  const snapshot = await prisma.trainingPlan.findUniqueOrThrow({
    where: { id: assignment.trainingPlanId },
    include: { workouts: { orderBy: { position: "asc" }, include: { workoutExercises: true } } },
  });
  const snapshotWorkoutA = snapshot.workouts[0]!;
  const snapshotWorkoutB = snapshot.workouts[1]!;

  return { tenant, owner, student, snapshotWorkoutA, snapshotWorkoutB, itemA, snapshotItemA: snapshotWorkoutA.workoutExercises[0]! };
}

describe("startOrResumeWorkoutSession (FIT-041)", () => {
  it("inicia uma sessão nova EM_ANDAMENTO para um treino do plano atribuído", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("iniciar");

    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    expect(session.status).toBe("EM_ANDAMENTO");
    expect(session.workoutId).toBe(snapshotWorkoutA.id);
    expect(session.endedAt).toBeNull();
    expect(session.workout.workoutExercises).toHaveLength(1);
  });

  it("retoma (não duplica) a sessão em andamento para o mesmo treino", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("retomar");

    const primeira = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    const segunda = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    expect(segunda.id).toBe(primeira.id);
    const total = await prisma.workoutSession.count({ where: { tenantId: tenant.id, studentId: student.id } });
    expect(total).toBe(1);
  });

  it("abandona automaticamente a sessão em andamento de outro treino antes de iniciar a nova", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotWorkoutB } = await createAssignedStudent("abandonar-auto");

    const sessaoA = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    const sessaoB = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutB.id },
      prisma
    );

    const sessaoAAtualizada = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessaoA.id } });
    expect(sessaoAAtualizada.status).toBe("ABANDONADA");
    expect(sessaoAAtualizada.endedAt).not.toBeNull();
    expect(sessaoB.status).toBe("EM_ANDAMENTO");

    const emAndamento = await getInProgressSessionForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);
    expect(emAndamento?.id).toBe(sessaoB.id);
  });

  it("rejeita um treino que não pertence ao plano atribuído (NAO_ENCONTRADO)", async () => {
    const { tenant, student } = await createAssignedStudent("treino-invalido");
    const outroWorkout = await createWorkout({ tenantId: tenant.id, name: `Fora do plano ${run}` }, prisma);

    await expect(
      startOrResumeWorkoutSession({ tenantId: tenant.id, studentId: student.id, workoutId: outroWorkout.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("rejeita aluno sem atribuição ativa (NAO_ENCONTRADO)", async () => {
    const { tenant } = await createTenant("sem-atribuicao");
    const student = await createStudent(tenant.id, "sem-atribuicao");
    const workout = await createWorkout({ tenantId: tenant.id, name: `Solto ${run}` }, prisma);

    await expect(
      startOrResumeWorkoutSession({ tenantId: tenant.id, studentId: student.id, workoutId: workout.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("no máximo uma sessão EM_ANDAMENTO por aluno é garantido fisicamente pelo índice único parcial", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotWorkoutB } = await createAssignedStudent("unicidade-fisica");

    await prisma.workoutSession.create({
      data: { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id, status: "EM_ANDAMENTO" },
    });

    await expect(
      prisma.workoutSession.create({
        data: { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutB.id, status: "EM_ANDAMENTO" },
      })
    ).rejects.toThrow();
  });
});

describe("recordSessionResult (FIT-041)", () => {
  it("registra o resultado executado de um item", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotItemA } = await createAssignedStudent("registrar");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    const result = await recordSessionResult(
      {
        tenantId: tenant.id,
        studentId: student.id,
        sessionId: session.id,
        workoutExerciseId: snapshotItemA.id,
        setsCompleted: 3,
        repsCompleted: 8,
        durationSecondsCompleted: null,
        loadUsed: "22kg",
      },
      prisma
    );

    expect(result.setsCompleted).toBe(3);
    expect(result.repsCompleted).toBe(8);
    expect(result.loadUsed).toBe("22kg");
  });

  it("reenviar o mesmo item substitui o resultado, nunca duplica (defesa contra dupla submissão)", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotItemA } = await createAssignedStudent("dupla-submissao");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    await recordSessionResult(
      {
        tenantId: tenant.id,
        studentId: student.id,
        sessionId: session.id,
        workoutExerciseId: snapshotItemA.id,
        setsCompleted: 3,
        repsCompleted: 8,
        durationSecondsCompleted: null,
        loadUsed: null,
      },
      prisma
    );
    const segundo = await recordSessionResult(
      {
        tenantId: tenant.id,
        studentId: student.id,
        sessionId: session.id,
        workoutExerciseId: snapshotItemA.id,
        setsCompleted: 4,
        repsCompleted: 6,
        durationSecondsCompleted: null,
        loadUsed: "25kg",
      },
      prisma
    );

    const total = await prisma.workoutSessionResult.count({ where: { workoutSessionId: session.id } });
    expect(total).toBe(1);
    expect(segundo.setsCompleted).toBe(4);
    expect(segundo.loadUsed).toBe("25kg");
  });

  it("rejeita item que não pertence ao treino da sessão", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("item-fora-do-treino");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    // Item de um aluno/plano completamente diferente — nunca pertence ao
    // treino desta sessão, mesmo sendo do mesmo tenant nesta simulação.
    const outro = await createAssignedStudent("item-fora-do-treino-b");

    await expect(
      recordSessionResult(
        {
          tenantId: tenant.id,
          studentId: student.id,
          sessionId: session.id,
          workoutExerciseId: outro.snapshotItemA.id,
          setsCompleted: 1,
          repsCompleted: 1,
          durationSecondsCompleted: null,
          loadUsed: null,
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("rejeita registrar resultado em sessão já concluída (ESTADO_INVALIDO)", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotItemA } = await createAssignedStudent("sessao-concluida");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);

    await expect(
      recordSessionResult(
        {
          tenantId: tenant.id,
          studentId: student.id,
          sessionId: session.id,
          workoutExerciseId: snapshotItemA.id,
          setsCompleted: 1,
          repsCompleted: 1,
          durationSecondsCompleted: null,
          loadUsed: null,
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });

  it("rejeita séries/repetições/duração não positivas", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotItemA } = await createAssignedStudent("valores-invalidos");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    await expect(
      recordSessionResult(
        {
          tenantId: tenant.id,
          studentId: student.id,
          sessionId: session.id,
          workoutExerciseId: snapshotItemA.id,
          setsCompleted: -1,
          repsCompleted: null,
          durationSecondsCompleted: null,
          loadUsed: null,
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("completeWorkoutSession / abandonWorkoutSession (FIT-041)", () => {
  it("conclui a sessão, define endedAt e rejeita concluir de novo", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("concluir");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    const concluida = await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);

    expect(concluida.status).toBe("CONCLUIDA");
    expect(concluida.endedAt).not.toBeNull();
    await expect(
      completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });

  it("abandona a sessão e preserva os resultados já registrados", async () => {
    const { tenant, student, snapshotWorkoutA, snapshotItemA } = await createAssignedStudent("abandonar");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    await recordSessionResult(
      {
        tenantId: tenant.id,
        studentId: student.id,
        sessionId: session.id,
        workoutExerciseId: snapshotItemA.id,
        setsCompleted: 2,
        repsCompleted: 5,
        durationSecondsCompleted: null,
        loadUsed: null,
      },
      prisma
    );

    const abandonada = await abandonWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);

    expect(abandonada.status).toBe("ABANDONADA");
    const resultado = await prisma.workoutSessionResult.findFirst({ where: { workoutSessionId: session.id } });
    expect(resultado?.setsCompleted).toBe(2);
  });

  it("rejeita concluir/abandonar sessão de outro aluno (NAO_ENCONTRADO)", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("cruzado-a");
    const outro = await createAssignedStudent("cruzado-b");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    await expect(
      completeWorkoutSession({ tenantId: outro.tenant.id, studentId: outro.student.id, sessionId: session.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("getSessionForStudent / isolamento (FIT-041)", () => {
  it("nunca retorna sessão de aluno de outro tenant", async () => {
    const { tenant, student, snapshotWorkoutA } = await createAssignedStudent("isolamento-a");
    const { tenant: outroTenant } = await createTenant("isolamento-b");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );

    const encontrada = await getSessionForStudent({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);
    const naoEncontrada = await getSessionForStudent(
      { tenantId: outroTenant.id, studentId: student.id, sessionId: session.id },
      prisma
    );

    expect(encontrada?.id).toBe(session.id);
    expect(naoEncontrada).toBeNull();
  });

  it("histórico preserva o treino vigente na execução mesmo após o aluno ser reatribuído a outro plano", async () => {
    const { tenant, owner, student, snapshotWorkoutA } = await createAssignedStudent("historico-preservado");
    const session = await startOrResumeWorkoutSession(
      { tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkoutA.id },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);

    const novoPlano = await createTrainingPlan({ tenantId: tenant.id, name: `Novo plano ${run}` }, prisma);
    await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: novoPlano.id },
      prisma
    );

    const sessaoAntiga = await getSessionForStudent({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);
    expect(sessaoAntiga?.workoutId).toBe(snapshotWorkoutA.id);
    expect(sessaoAntiga?.workout.name).toBe(snapshotWorkoutA.name);
  });
});
