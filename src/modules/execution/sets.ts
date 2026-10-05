import "server-only";
import type { PrismaClient, WorkoutSessionResult, WorkoutSetResult } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { formatLoadForStorage, parseLoadKg } from "@/shared/lib/load";
import { getCatalogExerciseForTenant } from "@/modules/exercises/exercises";
import { isCardioType } from "@/shared/lib/cardio";
import { SessionError, getInProgressSessionOwnedByStudentOrThrow } from "./sessions";

/// Registro por série (BK-11, FIT-153, ADR-015) e "última vez"/recordes
/// por série (BK-12). Cada série gravada também atualiza o agregado
/// `WorkoutSessionResult` do item (séries feitas, maior carga e as
/// repetições dessa série), para histórico, recordes e telas antigas.

const MAX_SET_NUMBER = 50;
const MAX_REPS = 1000;
const MAX_DURATION_SECONDS = 36_000;
const MAX_LOAD_KG = 1000;

export interface RecordWorkoutSetInput {
  tenantId: string;
  studentId: string;
  sessionId: string;
  workoutExerciseId: string;
  setNumber: number;
  reps: number | null;
  durationSeconds: number | null;
  loadKg: number | null;
  /// "Aparelho ocupado" (EPIC-38): exercício feito no lugar do prescrito.
  performedExerciseId?: string | null;
}

export interface RecordWorkoutSetResult {
  set: WorkoutSetResult;
  aggregate: WorkoutSessionResult | null;
  /// Maior carga que o aluno já fez neste exercício (em sessões concluídas
  /// anteriores) foi superada por esta série.
  personalRecord: boolean;
}

function assertIntInRange(value: number | null, label: string, min: number, max: number): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new SessionError("VALIDACAO", `${label} inválido.`);
  }
  return value;
}

function loadGramsFrom(loadKg: number | null): number | null {
  if (loadKg === null) return null;
  if (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > MAX_LOAD_KG) {
    throw new SessionError("VALIDACAO", "Carga inválida.");
  }
  return Math.round(loadKg * 1000);
}

async function itemOfSession(input: { tenantId: string; workoutExerciseId: string }, workoutId: string, client: PrismaClient) {
  const item = await client.workoutExercise.findFirst({ where: { id: input.workoutExerciseId, tenantId: input.tenantId, workoutId } });
  if (!item) throw new SessionError("NAO_ENCONTRADO", "Item do treino não encontrado nesta sessão.");
  return item;
}

/// Séries/resultados feitos com um exercício: o trocado na hora (EPIC-38)
/// ou, sem troca, o do treino.
function doneWith(exerciseId: string | { in: string[] }) {
  return { OR: [{ performedExerciseId: exerciseId }, { performedExerciseId: null, workoutExercise: { exerciseId } }] };
}

/// Maior carga (gramas) do aluno num exercício, em sessões CONCLUIDAS
/// diferentes de `excludeSessionId` — por série e, para sessões antigas
/// (antes do registro por série), pelo agregado.
export async function bestLoadGramsForExercise(
  input: { tenantId: string; studentId: string; exerciseId: string; excludeSessionId?: string },
  client: PrismaClient = prisma
): Promise<number | null> {
  const sessionFilter = { studentId: input.studentId, status: "CONCLUIDA" as const, ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}) };
  const [fromSets, aggregates] = await Promise.all([
    client.workoutSetResult.aggregate({
      where: { tenantId: input.tenantId, ...doneWith(input.exerciseId), workoutSession: sessionFilter },
      _max: { loadGrams: true },
    }),
    client.workoutSessionResult.findMany({
      where: { tenantId: input.tenantId, loadUsed: { not: null }, ...doneWith(input.exerciseId), workoutSession: sessionFilter },
      select: { loadUsed: true },
    }),
  ]);
  let best = fromSets._max.loadGrams ?? null;
  for (const aggregate of aggregates) {
    const kg = parseLoadKg(aggregate.loadUsed);
    if (kg !== null && kg > 0 && (best === null || kg * 1000 > best)) best = Math.round(kg * 1000);
  }
  return best;
}

async function syncAggregate(input: { tenantId: string; sessionId: string; workoutExerciseId: string }, client: Pick<PrismaClient, "workoutSetResult" | "workoutSessionResult">): Promise<WorkoutSessionResult | null> {
  const sets = await client.workoutSetResult.findMany({ where: { workoutSessionId: input.sessionId, workoutExerciseId: input.workoutExerciseId }, orderBy: { setNumber: "asc" } });
  const key = { workoutSessionId_workoutExerciseId: { workoutSessionId: input.sessionId, workoutExerciseId: input.workoutExerciseId } };
  if (sets.length === 0) {
    await client.workoutSessionResult.deleteMany({ where: { workoutSessionId: input.sessionId, workoutExerciseId: input.workoutExerciseId } });
    return null;
  }
  const top = sets.reduce((best, set) => ((set.loadGrams ?? -1) > (best.loadGrams ?? -1) || ((set.loadGrams ?? -1) === (best.loadGrams ?? -1) && (set.reps ?? 0) > (best.reps ?? 0)) ? set : best));
  const durations = sets.map((set) => set.durationSeconds ?? 0);
  const data = {
    setsCompleted: sets.length,
    repsCompleted: top.reps,
    durationSecondsCompleted: Math.max(...durations) || null,
    loadUsed: top.loadGrams ? formatLoadForStorage(top.loadGrams / 1000) : null,
    performedExerciseId: top.performedExerciseId,
  };
  return client.workoutSessionResult.upsert({
    where: key,
    create: { tenantId: input.tenantId, workoutSessionId: input.sessionId, workoutExerciseId: input.workoutExerciseId, ...data },
    update: data,
  });
}

export async function recordWorkoutSet(input: RecordWorkoutSetInput, client: PrismaClient = prisma): Promise<RecordWorkoutSetResult> {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);
  const item = await itemOfSession(input, session.workoutId, client);
  const setNumber = assertIntInRange(input.setNumber, "Número da série", 1, MAX_SET_NUMBER)!;
  const reps = assertIntInRange(input.reps, "Repetições", 1, MAX_REPS);
  const durationSeconds = assertIntInRange(input.durationSeconds, "Tempo", 1, MAX_DURATION_SECONDS);
  const loadGrams = loadGramsFrom(input.loadKg);
  if (reps === null && durationSeconds === null) {
    throw new SessionError("VALIDACAO", "Informe as repetições ou o tempo da série.");
  }

  let performedExerciseId: string | null = null;
  if (input.performedExerciseId && input.performedExerciseId !== item.exerciseId) {
    const [performed, planned] = await Promise.all([
      getCatalogExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.performedExerciseId }, client),
      client.exercise.findUniqueOrThrow({ where: { id: item.exerciseId }, select: { type: true } }),
    ]);
    if (!performed || performed.status !== "ATIVO" || isCardioType(performed.type) !== isCardioType(planned.type)) {
      throw new SessionError("VALIDACAO", "Exercício de troca inválido.");
    }
    performedExerciseId = performed.id;
  }
  const effectiveExerciseId = performedExerciseId ?? item.exerciseId;
  const previousBest = loadGrams ? await bestLoadGramsForExercise({ tenantId: input.tenantId, studentId: input.studentId, exerciseId: effectiveExerciseId, excludeSessionId: session.id }, client) : null;

  return client.$transaction(async (tx) => {
    const set = await tx.workoutSetResult.upsert({
      where: { workoutSessionId_workoutExerciseId_setNumber: { workoutSessionId: session.id, workoutExerciseId: item.id, setNumber } },
      create: { tenantId: input.tenantId, workoutSessionId: session.id, workoutExerciseId: item.id, setNumber, reps, durationSeconds, loadGrams, performedExerciseId },
      update: { reps, durationSeconds, loadGrams, performedExerciseId, completedAt: new Date() },
    });
    const aggregate = await syncAggregate({ tenantId: input.tenantId, sessionId: session.id, workoutExerciseId: item.id }, tx);
    return { set, aggregate, personalRecord: loadGrams !== null && loadGrams > 0 && previousBest !== null && loadGrams > previousBest };
  });
}

/// Desfaz uma série (toque errado em "Série feita").
export async function removeWorkoutSet(
  input: { tenantId: string; studentId: string; sessionId: string; workoutExerciseId: string; setNumber: number },
  client: PrismaClient = prisma
): Promise<WorkoutSessionResult | null> {
  const session = await getInProgressSessionOwnedByStudentOrThrow(input, client);
  const item = await itemOfSession(input, session.workoutId, client);
  return client.$transaction(async (tx) => {
    await tx.workoutSetResult.deleteMany({ where: { workoutSessionId: session.id, workoutExerciseId: item.id, setNumber: input.setNumber } });
    return syncAggregate({ tenantId: input.tenantId, sessionId: session.id, workoutExerciseId: item.id }, tx);
  });
}

export interface LastPerformance {
  loadKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  at: Date;
}

/// BK-12: "Última vez: X kg × Y" por exercício — a melhor série da sessão
/// concluída mais recente do aluno com aquele exercício (por série, ou o
/// agregado em sessões antigas). Também devolve a maior carga já feita.
export async function getLastPerformanceForExercises(
  input: { tenantId: string; studentId: string; exerciseIds: string[]; excludeSessionId?: string },
  client: PrismaClient = prisma
): Promise<Map<string, { last: LastPerformance | null; bestLoadKg: number | null }>> {
  const result = new Map<string, { last: LastPerformance | null; bestLoadKg: number | null }>();
  if (input.exerciseIds.length === 0) return result;
  const aggregates = await client.workoutSessionResult.findMany({
    where: {
      tenantId: input.tenantId,
      ...doneWith({ in: input.exerciseIds }),
      workoutSession: { studentId: input.studentId, status: "CONCLUIDA", ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}) },
    },
    include: { workoutExercise: { select: { exerciseId: true } }, workoutSession: { select: { startedAt: true } } },
    orderBy: { workoutSession: { startedAt: "desc" } },
  });
  for (const exerciseId of input.exerciseIds) result.set(exerciseId, { last: null, bestLoadKg: null });
  for (const aggregate of aggregates) {
    const entry = result.get(aggregate.performedExerciseId ?? aggregate.workoutExercise.exerciseId);
    if (!entry) continue;
    const kg = parseLoadKg(aggregate.loadUsed);
    if (!entry.last) {
      entry.last = { loadKg: kg && kg > 0 ? kg : null, reps: aggregate.repsCompleted, durationSeconds: aggregate.durationSecondsCompleted, at: aggregate.workoutSession.startedAt };
    }
    if (kg !== null && kg > 0 && (entry.bestLoadKg === null || kg > entry.bestLoadKg)) entry.bestLoadKg = kg;
  }
  return result;
}

export interface SessionSummary {
  activeSeconds: number;
  sets: number;
  volumeKg: number;
  /// Exercícios em que a maior carga desta sessão superou a melhor anterior.
  records: { exerciseName: string; loadKg: number }[];
  perceivedEffort: number | null;
}

/// Resumo do fim do treino (FIT-153): tempo ativo (ou o de relógio, se o
/// aparelho não informou), séries, volume (Σ repetições × carga) e novos
/// recordes (BK-12).
export async function getSessionSummary(
  input: { tenantId: string; studentId: string; sessionId: string },
  client: PrismaClient = prisma
): Promise<SessionSummary> {
  const session = await client.workoutSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId, studentId: input.studentId },
    include: {
      setResults: { include: { workoutExercise: { select: { exerciseId: true, exercise: { select: { name: true } } } }, performedExercise: { select: { name: true } } } },
      results: { include: { workoutExercise: { select: { id: true } } } },
    },
  });
  if (!session) throw new SessionError("NAO_ENCONTRADO", "Sessão não encontrada.");

  const wall = Math.max(0, Math.round(((session.endedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 1000));
  let sets = session.setResults.length;
  let volumeKg = session.setResults.reduce((sum, set) => sum + ((set.reps ?? 0) * (set.loadGrams ?? 0)) / 1000, 0);
  const itemsWithSets = new Set(session.setResults.map((set) => set.workoutExerciseId));
  for (const aggregate of session.results) {
    if (itemsWithSets.has(aggregate.workoutExerciseId)) continue;
    const count = aggregate.setsCompleted ?? 0;
    sets += count;
    volumeKg += count * (aggregate.repsCompleted ?? 0) * Math.max(0, parseLoadKg(aggregate.loadUsed) ?? 0);
  }

  const bestByExercise = new Map<string, { name: string; grams: number }>();
  for (const set of session.setResults) {
    if (!set.loadGrams) continue;
    const key = set.performedExerciseId ?? set.workoutExercise.exerciseId;
    const current = bestByExercise.get(key);
    if (!current || set.loadGrams > current.grams) bestByExercise.set(key, { name: set.performedExercise?.name ?? set.workoutExercise.exercise.name, grams: set.loadGrams });
  }
  const records: SessionSummary["records"] = [];
  for (const [exerciseId, best] of bestByExercise) {
    const previous = await bestLoadGramsForExercise({ tenantId: input.tenantId, studentId: input.studentId, exerciseId, excludeSessionId: session.id }, client);
    if (previous !== null && best.grams > previous) records.push({ exerciseName: best.name, loadKg: best.grams / 1000 });
  }

  return { activeSeconds: session.activeSeconds ?? wall, sets, volumeKg: Math.round(volumeKg * 10) / 10, records, perceivedEffort: session.perceivedEffort };
}
