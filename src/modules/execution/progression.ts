import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { parseLoadKg } from "@/shared/lib/load";

/// Sugestão de progressão (EPIC-30): nas duas últimas vezes em que fez o
/// exercício, a pessoa completou todas as séries e repetições com a mesma
/// carga e não marcou o treino como pesado (esforço ≤ 3). Sugere subir
/// 2,5 kg; aceitar grava a nova carga no próprio item do treino.
export interface ProgressionSuggestion {
  workoutId: string;
  itemId: string;
  workoutName: string;
  exerciseName: string;
  fromKg: number;
  toKg: number;
  reps: number;
}

const STEP_KG = 2.5;
const MAX_EFFORT = 3;

export async function suggestProgressions(input: { tenantId: string; studentId: string; limit?: number }, client: PrismaClient = prisma): Promise<ProgressionSuggestion[]> {
  const sessions = await client.workoutSession.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "CONCLUIDA" },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      perceivedEffort: true,
      setResults: {
        select: {
          workoutExerciseId: true,
          reps: true,
          loadGrams: true,
          workoutExercise: { select: { id: true, workoutId: true, sets: true, reps: true, load: true, intensity: true, exercise: { select: { name: true } }, workout: { select: { name: true, status: true, trainingPlan: { select: { isSnapshot: true } } } } } },
        },
      },
    },
  });

  // Por item: as duas sessões mais recentes em que apareceu.
  const byItem = new Map<string, { item: (typeof sessions)[number]["setResults"][number]["workoutExercise"]; runs: { effort: number | null; sets: { reps: number | null; loadGrams: number | null }[] }[] }>();
  for (const session of sessions) {
    const grouped = new Map<string, { reps: number | null; loadGrams: number | null }[]>();
    for (const result of session.setResults) {
      const list = grouped.get(result.workoutExerciseId) ?? [];
      list.push({ reps: result.reps, loadGrams: result.loadGrams });
      grouped.set(result.workoutExerciseId, list);
      if (!byItem.has(result.workoutExerciseId)) byItem.set(result.workoutExerciseId, { item: result.workoutExercise, runs: [] });
    }
    for (const [itemId, sets] of grouped) {
      const entry = byItem.get(itemId)!;
      if (entry.runs.length < 2) entry.runs.push({ effort: session.perceivedEffort, sets });
    }
  }

  const suggestions: ProgressionSuggestion[] = [];
  for (const { item, runs } of byItem.values()) {
    if (runs.length < 2 || item.intensity || !item.reps) continue;
    if (item.workout.status !== "ATIVO" || item.workout.trainingPlan.isSnapshot) continue;
    const loads = runs.flatMap((run) => run.sets.map((set) => set.loadGrams ?? 0));
    const load = loads[0] ?? 0;
    if (load <= 0 || loads.some((value) => value !== load)) continue;
    const complete = runs.every((run) => run.sets.length >= (item.sets ?? 1) && run.sets.every((set) => (set.reps ?? 0) >= item.reps!) && (run.effort === null || run.effort <= MAX_EFFORT));
    if (!complete) continue;
    const fromKg = load / 1000;
    const prescribed = parseLoadKg(item.load);
    if (prescribed !== null && prescribed > fromKg) continue;
    suggestions.push({ workoutId: item.workoutId, itemId: item.id, workoutName: item.workout.name, exerciseName: item.exercise.name, fromKg, toKg: fromKg + STEP_KG, reps: item.reps });
  }
  return suggestions.slice(0, input.limit ?? 2);
}
