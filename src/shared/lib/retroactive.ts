/// Treino retroativo (feature 2): regras puras, usadas na tela e no
/// servidor. Prazo de 7 dias contado a partir da realização; data futura
/// nunca. Duração única do treino em horas e minutos (declaratória).

export const RETRO_MAX_DAYS = 7;
const DAY_MS = 86_400_000;
/// Relógio do aparelho um pouco adiantado não vira "data futura".
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export function validatePerformedAt(performedAt: Date, now: Date): string | null {
  if (Number.isNaN(performedAt.getTime())) return "Informe a data e o horário do treino.";
  if (performedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return "A data do treino não pode ser no futuro.";
  if (now.getTime() - performedAt.getTime() > RETRO_MAX_DAYS * DAY_MS) return `Só dá para registrar treinos de até ${RETRO_MAX_DAYS} dias atrás.`;
  return null;
}

/// Duração total em segundos, ou a mensagem de erro.
export function durationSeconds(hours: number, minutes: number): number | string {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "Informe horas (0 a 23) e minutos (0 a 59).";
  const total = (hours * 60 + minutes) * 60;
  return total > 0 ? total : "Informe quanto tempo durou o treino.";
}

/// "1 h 05 min", "45 min".
export function durationLabel(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}

/// Exercícios e séries vindos do corpo da requisição (registro e edição):
/// só o formato; a validação é do servidor (`execution/retroactive`).
/// Com `withBlocks` (FEATURE_FUNCIONAL), mantém o `blockKey` de cada um.
export function parseRetroExercises(value: unknown, withBlocks = false): { exerciseId: string; blockKey?: string | null; sets: { reps: unknown; loadKg: unknown; durationSeconds: unknown }[] }[] {
  const exercises = Array.isArray(value) ? (value as { exerciseId?: unknown; blockKey?: unknown; sets?: unknown }[]) : [];
  return exercises.map((exercise) => ({
    exerciseId: String(exercise?.exerciseId ?? ""),
    ...(withBlocks && typeof exercise?.blockKey === "string" ? { blockKey: exercise.blockKey } : {}),
    sets: Array.isArray(exercise?.sets) ? (exercise.sets as Record<string, unknown>[]).map((set) => ({ reps: set?.reps ?? null, loadKg: set?.loadKg ?? null, durationSeconds: set?.durationSeconds ?? null })) : [],
  }));
}

/// Blocos do registro vindos do corpo (`[{ block, result }]`): só o
/// formato; a validação é do servidor.
export function parseRetroBlocksBody(value: unknown): { block: unknown; result: Record<string, unknown> }[] {
  const blocks = Array.isArray(value) ? (value as { block?: unknown; result?: unknown }[]) : [];
  return blocks.map((entry) => ({ block: entry?.block ?? null, result: entry?.result && typeof entry.result === "object" ? (entry.result as Record<string, unknown>) : {} }));
}
