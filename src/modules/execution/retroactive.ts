import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { ensureDraftTrainingPlanForTenant } from "@/modules/workouts/workouts";
import { getCatalogExerciseForTenant } from "@/modules/exercises/exercises";
import { isCardioType } from "@/shared/lib/cardio";
import { RETRO_MAX_DAYS, validatePerformedAt } from "@/shared/lib/retroactive";
import { recordRevision, sessionSnapshot } from "./sessionRevisions";
import { SessionError } from "./sessions";
import { rescoreSessionSafely, scoreSessionSafely } from "@/modules/gamification/sessionScoring";
import { MAX_DURATION_SECONDS, MAX_LOAD_KG, MAX_REPS, MAX_SET_NUMBER, syncAggregate } from "./sets";

/// Treino retroativo (feature 2, ADR-018): "Registrar treino realizado".
/// Tudo chega de uma vez (data, exercícios com séries, duração total) e
/// vira, numa transação, um treino avulso já concluído em modo RETROATIVO:
/// mesmo histórico, séries, recordes e avaliação do treino ao vivo, sem
/// rascunho no servidor competindo com o treino em andamento.
/// `operationKey` torna o envio idempotente. A foto vem depois, pelas
/// rotas de evidência (Fase 0).

export const RETRO_WORKOUT_NAME = "Treino registrado";
const MAX_EXERCISES = 30;
const DAY_SECONDS = 86_400;
/// Treino concluído perto do mesmo horário: avisa, sem bloquear.
const DUPLICATE_WINDOW_MS = 30 * 60_000;
/// Editar vale no mesmo prazo do registro.
export const RETRO_EDIT_DAYS = RETRO_MAX_DAYS;

export interface RetroSetInput {
  reps?: number | null;
  loadKg?: number | null;
  durationSeconds?: number | null;
}

export interface RetroExerciseInput {
  exerciseId: string;
  sets: RetroSetInput[];
}

export interface RecordRetroactiveInput {
  tenantId: string;
  studentId: string;
  operationKey: string;
  performedAt: Date;
  durationSeconds: number;
  exercises: RetroExerciseInput[];
  now?: Date;
}

export interface RetroactiveResult {
  sessionId: string;
  replayed: boolean;
  /// Já existe treino concluído perto desse horário (só aviso).
  possibleDuplicate: boolean;
}

function intOrNull(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new SessionError("VALIDACAO", `${label} inválido.`);
  return value;
}

function loadGrams(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_LOAD_KG) throw new SessionError("VALIDACAO", "Carga inválida.");
  return Math.round(value * 1000);
}

type ParsedItem = { exerciseId: string; cardio: boolean; sets: { reps: number | null; loadGrams: number | null; durationSeconds: number | null }[] };

function validateDuration(durationSeconds: number) {
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > DAY_SECONDS) {
    throw new SessionError("VALIDACAO", "Informe quanto tempo durou o treino.");
  }
}

/// Exercícios do catálogo visível e séries coerentes com o tipo.
async function parseItems(tenantId: string, exercises: RetroExerciseInput[], client: PrismaClient): Promise<ParsedItem[]> {
  if (exercises.length === 0) throw new SessionError("VALIDACAO", "Adicione pelo menos um exercício.");
  if (exercises.length > MAX_EXERCISES) throw new SessionError("VALIDACAO", `No máximo ${MAX_EXERCISES} exercícios por treino.`);
  if (new Set(exercises.map((exercise) => exercise.exerciseId)).size !== exercises.length) {
    throw new SessionError("VALIDACAO", "O mesmo exercício apareceu duas vezes. Junte as séries num só.");
  }

  const items: ParsedItem[] = [];
  for (const exercise of exercises) {
    const found = await getCatalogExerciseForTenant({ tenantId, exerciseId: exercise.exerciseId }, client);
    if (!found || found.status !== "ATIVO") throw new SessionError("NAO_ENCONTRADO", "Exercício não encontrado no catálogo.");
    if (exercise.sets.length === 0) throw new SessionError("VALIDACAO", `Informe pelo menos uma série de ${found.name}.`);
    if (exercise.sets.length > MAX_SET_NUMBER) throw new SessionError("VALIDACAO", "Séries demais.");
    const cardio = isCardioType(found.type);
    const sets = exercise.sets.map((set) => {
      const parsed = {
        reps: intOrNull(set.reps, "Repetições", 1, MAX_REPS),
        loadGrams: loadGrams(set.loadKg),
        durationSeconds: intOrNull(set.durationSeconds, "Tempo", 1, MAX_DURATION_SECONDS),
      };
      if (cardio ? parsed.durationSeconds === null : parsed.reps === null) {
        throw new SessionError("VALIDACAO", cardio ? `Informe o tempo de ${found.name}.` : `Informe as repetições de ${found.name}.`);
      }
      return parsed;
    });
    items.push({ exerciseId: found.id, cardio, sets });
  }
  return items;
}

/// Grava os exercícios e as séries do registro (criação e edição).
async function writeItems(tx: Prisma.TransactionClient, at: { tenantId: string; workoutId: string; sessionId: string; performedAt: Date }, items: ParsedItem[]) {
  for (const [position, item] of items.entries()) {
    const topReps = Math.max(0, ...item.sets.map((set) => set.reps ?? 0));
    const created = await tx.workoutExercise.create({
      data: {
        tenantId: at.tenantId,
        workoutId: at.workoutId,
        exerciseId: item.exerciseId,
        position,
        sets: item.sets.length,
        ...(item.cardio ? { durationSeconds: Math.max(...item.sets.map((set) => set.durationSeconds ?? 0)) } : topReps > 0 ? { reps: topReps } : {}),
      },
    });
    await tx.workoutSetResult.createMany({
      data: item.sets.map((set, index) => ({
        tenantId: at.tenantId,
        workoutSessionId: at.sessionId,
        workoutExerciseId: created.id,
        setNumber: index + 1,
        reps: set.reps,
        loadGrams: set.loadGrams,
        durationSeconds: set.durationSeconds,
        completedAt: at.performedAt,
      })),
    });
    await syncAggregate({ tenantId: at.tenantId, sessionId: at.sessionId, workoutExerciseId: created.id }, tx);
  }
  // Recordes e "última vez" datam pelo dia do treino, não do registro.
  await tx.workoutSessionResult.updateMany({ where: { workoutSessionId: at.sessionId, tenantId: at.tenantId }, data: { recordedAt: at.performedAt } });
}

export async function recordRetroactiveWorkout(input: RecordRetroactiveInput, client: PrismaClient = prisma): Promise<RetroactiveResult> {
  const now = input.now ?? new Date();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(input.operationKey)) throw new SessionError("VALIDACAO", "Operação inválida.");

  const replay = async (): Promise<RetroactiveResult | null> => {
    const existing = await client.workoutSession.findUnique({ where: { operationKey: input.operationKey }, select: { id: true, tenantId: true, studentId: true } });
    if (!existing) return null;
    if (existing.tenantId !== input.tenantId || existing.studentId !== input.studentId) throw new SessionError("VALIDACAO", "Operação inválida.");
    return { sessionId: existing.id, replayed: true, possibleDuplicate: false };
  };
  const previous = await replay();
  if (previous) return previous;

  const dateError = validatePerformedAt(input.performedAt, now);
  if (dateError) throw new SessionError("VALIDACAO", dateError);
  validateDuration(input.durationSeconds);
  const items = await parseItems(input.tenantId, input.exercises, client);

  const plan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);
  const performedAt = input.performedAt;
  const endedAt = new Date(performedAt.getTime() + input.durationSeconds * 1000);
  let sessionId: string;
  try {
    sessionId = await client.$transaction(async (tx) => {
      const max = await tx.workout.aggregate({ where: { trainingPlanId: plan.id, tenantId: input.tenantId }, _max: { position: true } });
      const workout = await tx.workout.create({
        data: { tenantId: input.tenantId, trainingPlanId: plan.id, name: RETRO_WORKOUT_NAME, position: (max._max.position ?? -1) + 1, status: "AVULSO" },
      });
      const session = await tx.workoutSession.create({
        data: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          workoutId: workout.id,
          status: "CONCLUIDA",
          mode: "RETROATIVO",
          startedAt: performedAt,
          endedAt,
          performedAt,
          recordedAt: now,
          declaredDurationSeconds: input.durationSeconds,
          operationKey: input.operationKey,
        },
      });
      await writeItems(tx, { tenantId: input.tenantId, workoutId: workout.id, sessionId: session.id, performedAt }, items);
      return session.id;
    });
  } catch (error) {
    // Mesmo envio em paralelo: o outro gravou primeiro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await replay();
      if (existing) return existing;
    }
    throw error;
  }

  // Desafios (feature 3): pontua sem nunca impedir o registro.
  await scoreSessionSafely(sessionId, client);
  const near = await client.workoutSession.count({
    where: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      status: "CONCLUIDA",
      id: { not: sessionId },
      startedAt: { gte: new Date(performedAt.getTime() - DUPLICATE_WINDOW_MS), lte: new Date(performedAt.getTime() + DUPLICATE_WINDOW_MS) },
    },
  });
  return { sessionId, replayed: false, possibleDuplicate: near > 0 };
}

export interface UpdateRetroactiveInput {
  tenantId: string;
  studentId: string;
  actorUserId: string;
  sessionId: string;
  performedAt: Date;
  durationSeconds: number;
  exercises: RetroExerciseInput[];
  now?: Date;
}

/// O registro ainda pode ser editado: retroativo concluído cuja data de
/// realização está dentro do prazo de registro (7 dias).
export function retroEditable(session: { mode: string; status: string; performedAt: Date | null; startedAt: Date }, now = new Date()): boolean {
  return session.mode === "RETROATIVO" && session.status === "CONCLUIDA" && validatePerformedAt(session.performedAt ?? session.startedAt, now) === null;
}

/// Edita um treino registrado (data, duração, exercícios e séries) dentro
/// do prazo. A versão anterior fica na trilha (`WorkoutSessionRevision`) e
/// a pontuação é recalculada pela diferença (evento RECALCULADO), uma vez.
/// Período já encerrado mantém o resultado congelado (`PeriodGoal`).
export async function updateRetroactiveWorkout(input: UpdateRetroactiveInput, client: PrismaClient = prisma): Promise<{ sessionId: string }> {
  const now = input.now ?? new Date();
  const session = await client.workoutSession.findFirst({ where: { id: input.sessionId, tenantId: input.tenantId, studentId: input.studentId } });
  if (!session) throw new SessionError("NAO_ENCONTRADO", "Treino não encontrado.");
  if (session.mode !== "RETROATIVO" || session.status !== "CONCLUIDA") throw new SessionError("ESTADO_INVALIDO", "Só um treino registrado pode ser editado.");
  if (!retroEditable(session, now)) throw new SessionError("ESTADO_INVALIDO", `O prazo para editar este registro acabou (${RETRO_EDIT_DAYS} dias depois do treino).`);
  const dateError = validatePerformedAt(input.performedAt, now);
  if (dateError) throw new SessionError("VALIDACAO", dateError);
  validateDuration(input.durationSeconds);
  const items = await parseItems(input.tenantId, input.exercises, client);

  const performedAt = input.performedAt;
  const score = await client.sessionScore.findUnique({ where: { sessionId: session.id }, select: { totalTenths: true, status: true } });
  const revision = await client.$transaction(async (tx) => {
    const snapshot = await sessionSnapshot(tx, session);
    const created = await recordRevision(tx, { tenantId: input.tenantId, studentId: input.studentId, sessionId: session.id, actorUserId: input.actorUserId, action: "EDITADO", snapshot, score });
    // Séries e resultados primeiro (apontam para os exercícios do treino).
    await tx.workoutSetResult.deleteMany({ where: { workoutSessionId: session.id, tenantId: input.tenantId } });
    await tx.workoutSessionResult.deleteMany({ where: { workoutSessionId: session.id, tenantId: input.tenantId } });
    await tx.workoutExercise.deleteMany({ where: { workoutId: session.workoutId, tenantId: input.tenantId } });
    await tx.workoutSession.update({
      where: { id: session.id },
      data: { performedAt, startedAt: performedAt, endedAt: new Date(performedAt.getTime() + input.durationSeconds * 1000), declaredDurationSeconds: input.durationSeconds },
    });
    await writeItems(tx, { tenantId: input.tenantId, workoutId: session.workoutId, sessionId: session.id, performedAt }, items);
    return created;
  });

  // Desafios: recalcula (e libera, se já há foto no prazo) sem impedir a edição.
  await rescoreSessionSafely(session.id, client, now);
  const after = await client.sessionScore.findUnique({ where: { sessionId: session.id }, select: { totalTenths: true } });
  if (after) await client.workoutSessionRevision.update({ where: { id: revision.id }, data: { pointsTenthsAfter: after.totalTenths } });
  return { sessionId: session.id };
}
