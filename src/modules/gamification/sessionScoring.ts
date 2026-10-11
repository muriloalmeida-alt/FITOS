import "server-only";
import { Prisma, type PrismaClient, type ScoringReferenceKind, type SessionScore, type SessionScoreStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { featureEnabled } from "@/shared/config/features";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { parseLoadKg } from "@/shared/lib/load";
import { isCardioType } from "@/shared/lib/cardio";
import { consolidatesAt, isConsolidated, periodOf } from "@/shared/lib/medals";
import { DEFAULT_CARDIO_REFERENCE_SECONDS, RULE_VERSION, balancedTenths, blockPointsTenths, blockSecondsDone, doneFor, isIsometric, isometricPointsTenths, itemPointsTenths, kindFor, type ScoredBlockResult, type ScoredSet } from "@/shared/lib/scoring";
import { blockElapsedSeconds, blockSummary, readBlocks, type WorkoutBlock } from "@/shared/lib/workoutBlocks";

/// FitOS Desafios (feature 3, ADR-019): pontuação de um treino concluído.
/// O servidor calcula a partir das séries registradas (nunca pontos
/// digitados); uma pontuação por sessão, idempotente. Sem foto, os pontos
/// ficam PENDENTE_FOTO; a foto dentro do prazo libera automaticamente
/// (24 h depois do treino ao vivo, 7 dias do retroativo). Falha aqui nunca
/// impede salvar ou concluir o treino (`scoreSessionSafely`).

const HOUR_MS = 3_600_000;
export const LIVE_PHOTO_HOURS = 24;
export const RETRO_PHOTO_DAYS = 7;
/// Contam no placar oficial.
export const OFFICIAL_STATUSES: SessionScoreStatus[] = ["LIBERADO", "CONTESTADO", "MANTIDO"];

export interface ScoredItem {
  /// Bloco (regra 2): `bloco:<chave>`.
  exerciseId: string;
  name: string;
  /// ISOMETRIA e BLOCO (regra 2) não usam referência.
  kind: ScoringReferenceKind | "ISOMETRIA" | "BLOCO";
  done: number;
  reference: number;
  /// De onde veio a referência (programa, primeira execução ou padrão).
  source: string;
  pointsTenths: number;
}

type Client = PrismaClient | Prisma.TransactionClient;

function photoDeadline(session: { mode: string; performedAt: Date | null; startedAt: Date; endedAt: Date | null }): Date {
  if (session.mode === "RETROATIVO") return new Date((session.performedAt ?? session.startedAt).getTime() + RETRO_PHOTO_DAYS * 24 * HOUR_MS);
  return new Date((session.endedAt ?? session.startedAt).getTime() + LIVE_PHOTO_HOURS * HOUR_MS);
}

/// Referência congelada do aluno para o exercício e a medida; criada na
/// primeira pontuação. Programa (não avulso) com prescrição: dela; senão,
/// a própria primeira execução (aeróbico sem tempo: 30 min).
async function referenceFor(
  client: Client,
  input: { tenantId: string; studentId: string; exerciseId: string; kind: ScoringReferenceKind; prescribed: number | null; firstExecution: number }
): Promise<{ value: number; source: string } | null> {
  const active = await client.scoringReference.findFirst({ where: { studentId: input.studentId, exerciseId: input.exerciseId, kind: input.kind, supersededAt: null }, select: { value: true, source: true } });
  if (active) return active;
  const value =
    input.prescribed && input.prescribed > 0 ? { value: input.prescribed, source: "PRESCRICAO" }
    : input.kind === "TEMPO" ? { value: DEFAULT_CARDIO_REFERENCE_SECONDS, source: "PADRAO" }
    : input.firstExecution > 0 ? { value: input.firstExecution, source: "PRIMEIRA_EXECUCAO" }
    : null;
  if (!value) return null;
  try {
    await client.scoringReference.create({ data: { tenantId: input.tenantId, studentId: input.studentId, exerciseId: input.exerciseId, kind: input.kind, value: value.value, source: value.source } });
    return value;
  } catch (error) {
    // Outra pontuação criou a mesma referência ao mesmo tempo: vale a dela.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return client.scoringReference.findFirst({ where: { studentId: input.studentId, exerciseId: input.exerciseId, kind: input.kind, supersededAt: null }, select: { value: true, source: true } });
    }
    throw error;
  }
}

/// Blocos com resultado (regra 2): um item por bloco, pelos minutos feitos.
/// Devolve também as chaves desses blocos, cujos exercícios não pontuam
/// de novo pelas séries.
export function scoreBlocks(
  blocks: WorkoutBlock[],
  results: (ScoredBlockResult & { blockKey: string; endedAt?: Date | null; startedAt?: Date | null; pausedSeconds?: number })[]
): { items: ScoredItem[]; keys: Set<string> } {
  const items: ScoredItem[] = [];
  for (const block of blocks) {
    const result = results.find((entry) => entry.blockKey === block.key && entry.outcome !== null);
    if (!result) continue;
    const measured = result.startedAt && result.endedAt ? blockElapsedSeconds({ startedAt: result.startedAt.toISOString(), pausedAt: null, pausedSeconds: result.pausedSeconds ?? 0, endedAt: result.endedAt.toISOString() }, result.endedAt) : 0;
    const seconds = blockSecondsDone(block, result, measured);
    items.push({ exerciseId: `bloco:${block.key}`, name: blockSummary(block), kind: "BLOCO", done: seconds, reference: 0, source: "BLOCO", pointsTenths: blockPointsTenths(seconds) });
  }
  return { items, keys: new Set(items.map((item) => item.exerciseId.slice("bloco:".length))) };
}

function prescribedFor(kind: ScoringReferenceKind, item: { sets: number | null; reps: number | null; load: string | null; durationSeconds: number | null }): number | null {
  if (kind === "TEMPO") return item.durationSeconds;
  if (!item.sets || !item.reps) return null;
  if (kind === "REPETICOES") return item.sets * item.reps;
  const kg = parseLoadKg(item.load);
  return kg && kg > 0 ? Math.round(item.sets * item.reps * kg * 1000) : null;
}

/// Calcula (ou recalcula) a pontuação de um treino concluído.
export async function scoreSession(sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<SessionScore | null> {
  const session = await client.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      workout: { select: { status: true, blocks: true } },
      blockResults: true,
      setResults: { select: { workoutExerciseId: true, reps: true, loadGrams: true, durationSeconds: true, performedExerciseId: true } },
      _count: { select: { evidences: true } },
    },
  });
  if (!session || session.status !== "CONCLUIDA") return null;
  const items = await client.workoutExercise.findMany({
    where: { workoutId: session.workoutId, tenantId: session.tenantId },
    orderBy: { position: "asc" },
    include: { exercise: { select: { id: true, name: true, type: true } } },
  });
  const program = session.workout.status !== "AVULSO";
  const swapIds = [...new Set(session.setResults.map((set) => set.performedExerciseId).filter((id): id is string => Boolean(id)))];
  const swaps = new Map((await client.exercise.findMany({ where: { id: { in: swapIds } }, select: { id: true, name: true, type: true } })).map((exercise) => [exercise.id, exercise]));

  const blocks = scoreBlocks(readBlocks(session.workout.blocks), session.blockResults);
  const scored: ScoredItem[] = [];
  for (const item of items) {
    if (item.blockKey && blocks.keys.has(item.blockKey)) continue;
    const sets: ScoredSet[] = session.setResults.filter((set) => set.workoutExerciseId === item.id);
    // "Aparelho ocupado": pontua pelo exercício feito no lugar do prescrito.
    const swapId = session.setResults.find((set) => set.workoutExerciseId === item.id && set.performedExerciseId)?.performedExerciseId ?? null;
    const exercise = (swapId && swaps.get(swapId)) || item.exercise;
    const cardio = isCardioType(exercise.type);
    if (isIsometric(cardio, sets)) {
      const seconds = sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
      scored.push({ exerciseId: exercise.id, name: exercise.name, kind: "ISOMETRIA", done: seconds, reference: 0, source: "ISOMETRIA", pointsTenths: isometricPointsTenths(seconds) });
      continue;
    }
    const kind = kindFor(cardio, sets);
    const done = doneFor(kind, sets);
    if (sets.length === 0 || done <= 0) {
      scored.push({ exerciseId: exercise.id, name: exercise.name, kind, done: 0, reference: 0, source: "SEM_EXECUCAO", pointsTenths: 0 });
      continue;
    }
    const reference = await referenceFor(client, {
      tenantId: session.tenantId,
      studentId: session.studentId,
      exerciseId: exercise.id,
      kind,
      prescribed: program && exercise.id === item.exercise.id ? prescribedFor(kind, item) : null,
      firstExecution: done,
    });
    scored.push({ exerciseId: exercise.id, name: exercise.name, kind, done, reference: reference?.value ?? 0, source: reference?.source ?? "SEM_REFERENCIA", pointsTenths: reference ? itemPointsTenths(kind, done, reference.value) : 0 });
  }

  scored.push(...blocks.items);
  const totalTenths = scored.reduce((sum, item) => sum + item.pointsTenths, 0);
  // Avulso/retroativo: previstos são os que entraram no treino.
  const plannedItems = scored.length;
  const data = {
    ruleVersion: RULE_VERSION,
    totalTenths,
    plannedItems,
    balancedTenths: balancedTenths(totalTenths, plannedItems),
    items: scored as unknown as Prisma.InputJsonValue,
    performedAt: session.performedAt ?? session.startedAt,
    photoDeadline: photoDeadline(session),
  };

  const existing = await client.sessionScore.findUnique({ where: { sessionId } });
  if (existing) {
    // Treino editado (retroativo, parte 2): a data também conta.
    if (existing.totalTenths === totalTenths && existing.ruleVersion === RULE_VERSION && existing.performedAt.getTime() === data.performedAt.getTime() && existing.photoDeadline.getTime() === data.photoDeadline.getTime()) return existing;
    return client.$transaction(async (tx) => {
      const updated = await tx.sessionScore.update({ where: { id: existing.id }, data });
      await tx.scoreEvent.create({ data: { sessionScoreId: existing.id, kind: "RECALCULADO", totalTenths, fromStatus: existing.status, toStatus: existing.status } });
      return updated;
    });
  }
  const released = session._count.evidences > 0 && now <= data.photoDeadline;
  const status: SessionScoreStatus = released ? "LIBERADO" : "PENDENTE_FOTO";
  try {
    return await client.$transaction(async (tx) => {
      const created = await tx.sessionScore.create({ data: { ...data, tenantId: session.tenantId, studentId: session.studentId, sessionId, status, releasedAt: released ? now : null } });
      await tx.scoreEvent.create({ data: { sessionScoreId: created.id, kind: "CALCULADO", totalTenths, toStatus: status } });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return client.sessionScore.findUnique({ where: { sessionId } });
    throw error;
  }
}

/// Pontua sem nunca derrubar quem chamou (concluir, registrar). Só com
/// `FEATURE_GAMIFICACAO=on`.
export async function scoreSessionSafely(sessionId: string, client: PrismaClient = prisma): Promise<void> {
  if (!featureEnabled("GAMIFICACAO")) return;
  try {
    await scoreSession(sessionId, client);
  } catch (error) {
    logEvent("error", "desafios.pontuacao_falhou", { sessionId, ...describeError(error) });
  }
}

/// Treino editado: recalcula pela diferença e, se já há foto no novo
/// prazo, libera. Nunca derruba a edição.
export async function rescoreSessionSafely(sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  if (!featureEnabled("GAMIFICACAO")) return;
  try {
    await scoreSession(sessionId, client, now);
    if ((await client.workoutEvidencePhoto.count({ where: { sessionId } })) > 0) await releaseOnEvidence(sessionId, client, now);
  } catch (error) {
    logEvent("error", "desafios.recalculo_falhou", { sessionId, ...describeError(error) });
  }
}

/// A foto chegou: libera os pontos pendentes se ainda está no prazo.
export async function releaseOnEvidence(sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<SessionScoreStatus | null> {
  const score = await client.sessionScore.findUnique({ where: { sessionId } });
  if (!score) return null;
  if (score.status !== "PENDENTE_FOTO" || now > score.photoDeadline) return score.status;
  const { count } = await client.sessionScore.updateMany({ where: { id: score.id, status: "PENDENTE_FOTO" }, data: { status: "LIBERADO", releasedAt: now } });
  if (count > 0) await client.scoreEvent.create({ data: { sessionScoreId: score.id, kind: "LIBERADO", totalTenths: score.totalTenths, fromStatus: "PENDENTE_FOTO", toStatus: "LIBERADO" } });
  return count > 0 ? "LIBERADO" : (await client.sessionScore.findUniqueOrThrow({ where: { id: score.id } })).status;
}

/// Saiu a última foto: os pontos voltam a pendentes (estorno do placar).
/// Pontuação anulada por contestação continua anulada.
export async function revertOnEvidenceRemoved(sessionId: string, remaining: number, client: PrismaClient = prisma): Promise<void> {
  if (remaining > 0) return;
  const score = await client.sessionScore.findUnique({ where: { sessionId } });
  if (!score || !OFFICIAL_STATUSES.includes(score.status)) return;
  const { count } = await client.sessionScore.updateMany({ where: { id: score.id, status: score.status }, data: { status: "PENDENTE_FOTO", releasedAt: null } });
  if (count > 0) await client.scoreEvent.create({ data: { sessionScoreId: score.id, kind: "ESTORNADO", totalTenths: score.totalTenths, fromStatus: score.status, toStatus: "PENDENTE_FOTO", reason: "Última foto removida" } });
}

export type SessionPoints = Pick<SessionScore, "totalTenths" | "balancedTenths" | "plannedItems" | "status" | "photoDeadline"> & {
  /// Para o recurso de uma contestação.
  scoreId: string;
  items: ScoredItem[];
  /// Se os pontos (ainda) contam na semana e no mês do treino: período
  /// consolidado só leva o que foi liberado até a consolidação.
  countsIn: { week: boolean; month: boolean };
};

function countsInPeriod(type: "SEMANA" | "MES", score: { performedAt: Date; releasedAt: Date | null }, now: Date): boolean {
  const period = periodOf(type, score.performedAt);
  if (!isConsolidated(period, now)) return true;
  return score.releasedAt !== null && score.releasedAt.getTime() <= consolidatesAt(period).getTime();
}

export async function getSessionPoints(scope: { tenantId: string; studentId: string }, sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<SessionPoints | null> {
  const score = await client.sessionScore.findFirst({ where: { sessionId, tenantId: scope.tenantId, studentId: scope.studentId } });
  if (!score) return null;
  return {
    scoreId: score.id,
    totalTenths: score.totalTenths,
    balancedTenths: score.balancedTenths,
    plannedItems: score.plannedItems,
    status: score.status,
    photoDeadline: score.photoDeadline,
    items: score.items as unknown as ScoredItem[],
    countsIn: { week: countsInPeriod("SEMANA", score, now), month: countsInPeriod("MES", score, now) },
  };
}

/// Prévia dos pontos de um treino ainda não salvo (retroativo, etapa de
/// revisão): mesmas regras, lendo as referências sem criar nenhuma. Sem
/// referência, a primeira execução vira a referência (10 pontos), como
/// fará a pontuação de verdade num treino avulso.
export async function previewPoints(
  scope: { tenantId: string; studentId: string },
  exercises: { exerciseId: string; sets: ScoredSet[]; blockKey?: string | null }[],
  client: PrismaClient = prisma,
  /// Blocos do registro com o resultado declarado (regra 2).
  blocksInput: { block: WorkoutBlock; result: ScoredBlockResult }[] = []
): Promise<{ totalTenths: number; items: { exerciseId: string; pointsTenths: number }[] }> {
  const blocks = scoreBlocks(blocksInput.map((entry) => entry.block), blocksInput.map((entry) => ({ ...entry.result, blockKey: entry.block.key })));
  const found = await client.exercise.findMany({ where: { id: { in: exercises.map((exercise) => exercise.exerciseId) } }, select: { id: true, type: true } });
  const types = new Map(found.map((exercise) => [exercise.id, exercise.type]));
  const items: { exerciseId: string; pointsTenths: number }[] = [];
  for (const exercise of exercises) {
    if (exercise.blockKey && blocks.keys.has(exercise.blockKey)) continue;
    const cardio = isCardioType(types.get(exercise.exerciseId));
    if (isIsometric(cardio, exercise.sets)) {
      items.push({ exerciseId: exercise.exerciseId, pointsTenths: isometricPointsTenths(exercise.sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0)) });
      continue;
    }
    const kind = kindFor(cardio, exercise.sets);
    const done = doneFor(kind, exercise.sets);
    if (done <= 0) {
      items.push({ exerciseId: exercise.exerciseId, pointsTenths: 0 });
      continue;
    }
    const active = await client.scoringReference.findFirst({ where: { studentId: scope.studentId, exerciseId: exercise.exerciseId, kind, supersededAt: null }, select: { value: true } });
    const reference = active?.value ?? (kind === "TEMPO" ? DEFAULT_CARDIO_REFERENCE_SECONDS : done);
    items.push({ exerciseId: exercise.exerciseId, pointsTenths: itemPointsTenths(kind, done, reference) });
  }
  items.push(...blocks.items.map((item) => ({ exerciseId: item.exerciseId, pointsTenths: item.pointsTenths })));
  return { totalTenths: items.reduce((sum, item) => sum + item.pointsTenths, 0), items };
}
