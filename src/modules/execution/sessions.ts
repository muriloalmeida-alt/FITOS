import "server-only";
import {
  type Workout,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutSessionResult,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getActivePlanAssignmentForStudent } from "@/modules/workouts/workouts";

/// Execução de sessão de treino (FIT-041). Toda sessão referencia um
/// `Workout` do plano-snapshot da atribuição ativa do aluno (ADR-005) —
/// nunca o modelo editável do personal. "Registrar autor, data e tipo de
/// alteração" (`REGRAS-DE-NEGOCIO.md`, seção 9) lista explicitamente
/// "plano atribuído, avaliação e pagamento" — sessão não está nessa
/// lista, então nenhuma função deste módulo grava `AuditEvent` (decisão
/// registrada, não um esquecimento).

export class SessionError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "ESTADO_INVALIDO",
    message: string
  ) {
    super(message);
    this.name = "SessionError";
  }
}

const MAX_LOAD_LENGTH = 80;

function normalizeOptionalPositiveInt(value: number | null, label: string): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new SessionError("VALIDACAO", `${label} deve ser um número inteiro maior que zero.`);
  }
  return value;
}

function normalizeOptionalText(value: string | null, label: string, maxLength: number): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new SessionError("VALIDACAO", `${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return trimmed;
}

export type WorkoutSessionWithDetails = WorkoutSession & {
  workout: Workout & {
    workoutExercises: (WorkoutExercise & {
      exercise: { name: string; muscle: string | null; instructions: string | null };
    })[];
  };
  results: WorkoutSessionResult[];
};

const SESSION_INCLUDE = {
  workout: {
    include: {
      workoutExercises: {
        orderBy: { position: "asc" as const },
        include: { exercise: { select: { name: true, muscle: true, instructions: true } } },
      },
    },
  },
  results: true,
};

export interface StartOrResumeSessionInput {
  tenantId: string;
  studentId: string;
  workoutId: string;
}

/// Inicia ou retoma a sessão do aluno para `workoutId` — precisa
/// pertencer ao plano-snapshot da atribuição ativa do aluno (`NAO_ENCONTRADO`
/// caso contrário, mesmo padrão de isolamento do restante da aplicação).
/// Se já existe uma sessão `EM_ANDAMENTO` para o **mesmo** treino, retoma
/// (retorna a existente — "continuar"). Se existe uma sessão
/// `EM_ANDAMENTO` para **outro** treino, abandona essa automaticamente
/// antes de criar a nova, na mesma transação — mesmo padrão já usado em
/// `assignTrainingPlanToStudent` (FIT-033) para nunca alcançar a
/// unicidade física (`workout_sessions_in_progress_per_student_key`) por
/// exceção.
export async function startOrResumeWorkoutSession(
  input: StartOrResumeSessionInput,
  client: PrismaClient = prisma
): Promise<WorkoutSessionWithDetails> {
  const active = await getActivePlanAssignmentForStudent(
    { tenantId: input.tenantId, studentId: input.studentId },
    client
  );
  const workoutBelongsToActivePlan = active?.trainingPlan.workouts.some((workout) => workout.id === input.workoutId) ?? false;
  if (!workoutBelongsToActivePlan) {
    throw new SessionError("NAO_ENCONTRADO", "Treino não encontrado no programa atribuído.");
  }

  const inProgress = await client.workoutSession.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "EM_ANDAMENTO" },
  });

  if (inProgress && inProgress.workoutId === input.workoutId) {
    return client.workoutSession.findUniqueOrThrow({ where: { id: inProgress.id }, include: SESSION_INCLUDE });
  }

  const created = await client.$transaction(async (tx) => {
    if (inProgress) {
      await tx.workoutSession.update({
        where: { id: inProgress.id },
        data: { status: "ABANDONADA", endedAt: new Date() },
      });
    }
    return tx.workoutSession.create({
      data: { tenantId: input.tenantId, studentId: input.studentId, workoutId: input.workoutId },
    });
  });

  return client.workoutSession.findUniqueOrThrow({ where: { id: created.id }, include: SESSION_INCLUDE });
}

/// Sessão `EM_ANDAMENTO` do aluno, se houver — usada para decidir
/// "continuar" antes mesmo de saber qual é o treino de hoje.
export async function getInProgressSessionForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<WorkoutSessionWithDetails | null> {
  return client.workoutSession.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "EM_ANDAMENTO" },
    include: SESSION_INCLUDE,
  });
}

/// Busca uma sessão **apenas se pertencer ao aluno e ao tenant
/// informados** — mesmo padrão de isolamento do restante da aplicação.
export async function getSessionForStudent(
  input: { tenantId: string; studentId: string; sessionId: string },
  client: PrismaClient = prisma
): Promise<WorkoutSessionWithDetails | null> {
  return client.workoutSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId, studentId: input.studentId },
    include: SESSION_INCLUDE,
  });
}

async function getInProgressSessionOwnedByStudentOrThrow(
  input: { tenantId: string; studentId: string; sessionId: string },
  client: PrismaClient
): Promise<WorkoutSession> {
  const session = await client.workoutSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId, studentId: input.studentId },
  });
  if (!session) {
    throw new SessionError("NAO_ENCONTRADO", "Sessão não encontrada.");
  }
  if (session.status !== "EM_ANDAMENTO") {
    throw new SessionError("ESTADO_INVALIDO", "Esta sessão já foi concluída ou abandonada.");
  }
  return session;
}

export interface RecordSessionResultInput {
  tenantId: string;
  studentId: string;
  sessionId: string;
  workoutExerciseId: string;
  setsCompleted: number | null;
  repsCompleted: number | null;
  durationSecondsCompleted: number | null;
  loadUsed: string | null;
}

/// Registra (ou substitui) o resultado executado de um item, dentro de
/// uma sessão `EM_ANDAMENTO`. Upsert por `[workoutSessionId, workoutExerciseId]`
/// — reenviar o mesmo item nunca cria uma segunda linha, é a própria
/// defesa física contra dupla submissão (a checagem de `isSubmitting` na
/// UI é a primeira camada, não a única). `workoutExerciseId` precisa
/// pertencer ao `Workout` da própria sessão — nunca a outro treino,
/// mesmo do mesmo tenant.
export async function recordSessionResult(
  input: RecordSessionResultInput,
  client: PrismaClient = prisma
): Promise<WorkoutSessionResult> {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);

  const item = await client.workoutExercise.findFirst({
    where: { id: input.workoutExerciseId, tenantId: input.tenantId, workoutId: session.workoutId },
  });
  if (!item) {
    throw new SessionError("NAO_ENCONTRADO", "Item do treino não encontrado nesta sessão.");
  }

  const setsCompleted = normalizeOptionalPositiveInt(input.setsCompleted, "Séries executadas");
  const repsCompleted = normalizeOptionalPositiveInt(input.repsCompleted, "Repetições executadas");
  const durationSecondsCompleted = normalizeOptionalPositiveInt(input.durationSecondsCompleted, "A duração executada");
  const loadUsed = normalizeOptionalText(input.loadUsed, "A carga utilizada", MAX_LOAD_LENGTH);

  return client.workoutSessionResult.upsert({
    where: {
      workoutSessionId_workoutExerciseId: { workoutSessionId: input.sessionId, workoutExerciseId: input.workoutExerciseId },
    },
    create: {
      tenantId: input.tenantId,
      workoutSessionId: input.sessionId,
      workoutExerciseId: input.workoutExerciseId,
      setsCompleted,
      repsCompleted,
      durationSecondsCompleted,
      loadUsed,
    },
    update: { setsCompleted, repsCompleted, durationSecondsCompleted, loadUsed },
  });
}

/// Conclui uma sessão `EM_ANDAMENTO`. Rejeita (`ESTADO_INVALIDO`) se a
/// sessão já foi concluída ou abandonada — nunca reabre nem "conclui de
/// novo" silenciosamente.
export async function completeWorkoutSession(
  input: { tenantId: string; studentId: string; sessionId: string },
  client: PrismaClient = prisma
): Promise<WorkoutSession> {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);
  return client.workoutSession.update({ where: { id: session.id }, data: { status: "CONCLUIDA", endedAt: new Date() } });
}

/// Abandona uma sessão `EM_ANDAMENTO`. Mesma validação de `completeWorkoutSession`
/// — os resultados já registrados permanecem (nenhuma exclusão física).
export async function abandonWorkoutSession(
  input: { tenantId: string; studentId: string; sessionId: string },
  client: PrismaClient = prisma
): Promise<WorkoutSession> {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);
  return client.workoutSession.update({ where: { id: session.id }, data: { status: "ABANDONADA", endedAt: new Date() } });
}
