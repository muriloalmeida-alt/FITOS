import "server-only";
import type { PrismaClient, Workout } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { WorkoutError, addWorkoutExercisesBatch, ensureDraftTrainingPlanForTenant } from "@/modules/workouts/workouts";
import { SessionError, discardEmptyFreeSession, getSessionForStudent, getInProgressSessionOwnedByStudentOrThrow, type WorkoutSessionWithDetails } from "./sessions";

/// Treino avulso do FitOS Livre: começa vazio e o praticante informa cada
/// exercício durante a execução (pouco tempo, academia lotada). Por baixo
/// é um `Workout` com `status: "AVULSO"` no plano rascunho, fora de todas
/// as listas de treinos, com uma única sessão; assim séries, recordes,
/// "última vez" e histórico usam o mesmo motor do treino montado.

export const FREE_WORKOUT_NAME = "Treino avulso";
const MAX_NAME_LENGTH = 80;

type Executor = { tenantId: string; studentId: string };

/// Retoma o treino avulso em andamento ou começa um novo. Outra sessão em
/// andamento (de um treino montado) é abandonada, como em
/// `startOrResumeIndividualWorkoutSession`.
export async function startOrResumeFreeWorkoutSession(input: Executor, client: PrismaClient = prisma): Promise<WorkoutSessionWithDetails> {
  const inProgress = await client.workoutSession.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "EM_ANDAMENTO" },
    include: { workout: { select: { status: true } } },
  });
  if (inProgress?.workout.status === "AVULSO") {
    return (await getSessionForStudent({ ...input, sessionId: inProgress.id }, client))!;
  }

  const plan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);
  const created = await client.$transaction(async (tx) => {
    if (inProgress && !(await discardEmptyFreeSession(inProgress, tx))) {
      await tx.workoutSession.update({ where: { id: inProgress.id }, data: { status: "ABANDONADA", endedAt: new Date() } });
    }
    const max = await tx.workout.aggregate({ where: { trainingPlanId: plan.id, tenantId: input.tenantId }, _max: { position: true } });
    const workout = await tx.workout.create({
      data: { tenantId: input.tenantId, trainingPlanId: plan.id, name: FREE_WORKOUT_NAME, position: (max._max.position ?? -1) + 1, status: "AVULSO" },
    });
    return tx.workoutSession.create({ data: { tenantId: input.tenantId, studentId: input.studentId, workoutId: workout.id } });
  });
  return (await getSessionForStudent({ ...input, sessionId: created.id }, client))!;
}

/// Inclui exercícios do catálogo no treino avulso em andamento, no fim e
/// com a prescrição padrão do espaço (aeróbico: 20 min, moderado).
export async function addExercisesToFreeSession(
  input: Executor & { sessionId: string; exerciseIds: string[] },
  client: PrismaClient = prisma
) {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);
  const workout = await client.workout.findUniqueOrThrow({ where: { id: session.workoutId }, select: { status: true } });
  if (workout.status !== "AVULSO") {
    throw new SessionError("ESTADO_INVALIDO", "Só dá para incluir exercícios no treino avulso.");
  }
  let created;
  try {
    created = await addWorkoutExercisesBatch({ tenantId: input.tenantId, workoutId: session.workoutId, exerciseIds: input.exerciseIds }, client);
  } catch (error) {
    if (error instanceof WorkoutError) throw new SessionError(error.kind === "NAO_ENCONTRADO" ? "NAO_ENCONTRADO" : "VALIDACAO", error.message);
    throw error;
  }
  return client.workoutExercise.findMany({
    where: { id: { in: created.map((item) => item.id) } },
    orderBy: { position: "asc" },
    include: { exercise: { select: { name: true, instructions: true, imageUrl: true, imageAlt: true } } },
  });
}

/// "Salvar nos meus treinos": o treino avulso concluído vira um treino
/// montado (ATIVO), com os exercícios feitos, para repetir outro dia.
export async function saveFreeWorkout(input: Executor & { sessionId: string; name?: string | null }, client: PrismaClient = prisma): Promise<Workout> {
  const session = await client.workoutSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId, studentId: input.studentId },
    include: { workout: { select: { id: true, status: true } } },
  });
  if (!session) throw new SessionError("NAO_ENCONTRADO", "Sessão não encontrada.");
  if (session.status !== "CONCLUIDA") throw new SessionError("ESTADO_INVALIDO", "Conclua o treino antes de salvar.");
  if (session.workout.status !== "AVULSO") throw new SessionError("ESTADO_INVALIDO", "Este treino já está nos seus treinos.");
  const name = input.name?.trim() || FREE_WORKOUT_NAME;
  if (name.length > MAX_NAME_LENGTH) throw new SessionError("VALIDACAO", `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  const items = await client.workoutExercise.findMany({
    where: { workoutId: session.workout.id, tenantId: input.tenantId },
    include: { workoutSetResults: { where: { workoutSessionId: session.id } } },
  });
  return client.$transaction(async (tx) => {
    // O treino salvo é o que foi feito: séries e repetições da sessão;
    // exercício incluído e não feito sai.
    for (const item of items) {
      const sets = item.workoutSetResults;
      if (sets.length === 0) {
        await tx.workoutExercise.delete({ where: { id: item.id } });
      } else if (!item.intensity) {
        const reps = Math.max(0, ...sets.map((set) => set.reps ?? 0));
        await tx.workoutExercise.update({ where: { id: item.id }, data: { sets: sets.length, ...(reps > 0 ? { reps } : {}) } });
      }
    }
    return tx.workout.update({ where: { id: session.workout.id }, data: { status: "ATIVO", name } });
  });
}
