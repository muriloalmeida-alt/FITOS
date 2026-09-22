import "server-only";
import { type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Histórico, frequência e recordes de execução (FIT-104) — sempre
/// derivados de `WorkoutSession`/`WorkoutSessionResult` (FIT-041), nunca
/// um novo modelo: nenhuma linha nova é gravada por este módulo, é
/// somente leitura, genérico por `[studentId, tenantId]` como o resto do
/// motor de execução.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FinishedSessionSummary {
  id: string;
  workoutName: string;
  status: "CONCLUIDA" | "ABANDONADA";
  startedAt: Date;
  endedAt: Date | null;
  resultsCount: number;
}

/// Sessões concluídas ou abandonadas, mais recente primeiro — a sessão
/// `EM_ANDAMENTO` (se houver) nunca aparece aqui, ela já tem sua própria
/// tela (`getInProgressSessionForStudent`).
export async function listSessionHistoryForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<FinishedSessionSummary[]> {
  const sessions = await client.workoutSession.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: { in: ["CONCLUIDA", "ABANDONADA"] } },
    orderBy: { startedAt: "desc" },
    include: { workout: { select: { name: true } }, results: { select: { id: true } } },
  });

  return sessions.map((session) => ({
    id: session.id,
    workoutName: session.workout.name,
    status: session.status as "CONCLUIDA" | "ABANDONADA",
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    resultsCount: session.results.length,
  }));
}

export interface FrequencySummary {
  totalConcluded: number;
  last7Days: number;
  last30Days: number;
}

/// Contagem de sessões `CONCLUIDA` — total, e nas últimas duas janelas
/// (por `endedAt`, o momento real da conclusão, nunca `startedAt`).
export async function getFrequencySummaryForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<FrequencySummary> {
  const concluded = await client.workoutSession.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "CONCLUIDA" },
    select: { endedAt: true },
  });

  const now = Date.now();
  const sevenDaysAgo = now - 7 * MS_PER_DAY;
  const thirtyDaysAgo = now - 30 * MS_PER_DAY;

  let last7Days = 0;
  let last30Days = 0;
  for (const session of concluded) {
    const endedAtMs = session.endedAt?.getTime();
    if (endedAtMs === undefined) continue;
    if (endedAtMs >= sevenDaysAgo) last7Days += 1;
    if (endedAtMs >= thirtyDaysAgo) last30Days += 1;
  }

  return { totalConcluded: concluded.length, last7Days, last30Days };
}

export interface PersonalRecord {
  exerciseName: string;
  loadUsed: string;
  loadValue: number;
  repsCompleted: number | null;
  achievedAt: Date;
}

/// Extrai o valor numérico inicial de uma carga em texto livre ("20kg" →
/// 20, "60,5 kg" → 60.5, "peso corporal" → null — carga sem número não
/// participa do ranking, não é um erro). `loadUsed` é texto livre desde a
/// FIT-041 (nunca um número estruturado), então este é o único jeito de
/// comparar cargas sem inventar uma migração de dado retroativa.
function parseLoadValue(loadUsed: string): number | null {
  const match = loadUsed.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1]!);
  return Number.isFinite(value) ? value : null;
}

/// Melhor carga numérica já registrada por exercício, entre sessões
/// `CONCLUIDA` — um "recorde" é sempre por exercício (nunca por treino),
/// já que o mesmo exercício pode aparecer em treinos diferentes.
export async function listPersonalRecordsForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<PersonalRecord[]> {
  const results = await client.workoutSessionResult.findMany({
    where: {
      tenantId: input.tenantId,
      loadUsed: { not: null },
      workoutSession: { studentId: input.studentId, status: "CONCLUIDA" },
    },
    include: { workoutExercise: { include: { exercise: { select: { name: true } } } } },
  });

  const bestByExercise = new Map<string, PersonalRecord>();

  for (const result of results) {
    const loadValue = parseLoadValue(result.loadUsed!);
    if (loadValue === null) continue;

    const exerciseName = result.workoutExercise.exercise.name;
    const current = bestByExercise.get(exerciseName);
    if (!current || loadValue > current.loadValue) {
      bestByExercise.set(exerciseName, {
        exerciseName,
        loadUsed: result.loadUsed!,
        loadValue,
        repsCompleted: result.repsCompleted,
        achievedAt: result.recordedAt,
      });
    }
  }

  return Array.from(bestByExercise.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "pt-BR"));
}
