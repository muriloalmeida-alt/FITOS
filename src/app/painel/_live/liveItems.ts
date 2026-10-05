import { parseLoadKg } from "@/shared/lib/load";
import type { LiveItem } from "./LiveWorkout";

/// Itens do treino ao vivo (FIT-153/FIT-158) a partir do treino, das
/// séries já feitas na sessão e da "última vez" (BK-12).
export interface PlanItem {
  id: string;
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: { name: string; instructions: string | null; imageUrl: string | null; imageAlt: string | null };
}

export function toLiveItems(
  items: PlanItem[],
  sets: { workoutExerciseId: string; setNumber: number; reps: number | null; durationSeconds: number | null; loadGrams: number | null }[],
  last: Map<string, { last: { loadKg: number | null; reps: number | null; durationSeconds: number | null } | null }>
): LiveItem[] {
  return items.map((item) => {
    const loadKg = parseLoadKg(item.load);
    return {
      id: item.id,
      name: item.exercise.name,
      imageUrl: item.exercise.imageUrl,
      imageAlt: item.exercise.imageAlt,
      instructions: item.exercise.instructions,
      sets: item.sets,
      reps: item.reps,
      durationSeconds: item.durationSeconds,
      loadKg: loadKg && loadKg > 0 ? loadKg : null,
      load: item.load,
      restSeconds: item.restSeconds,
      notes: item.notes,
      doneSets: sets
        .filter((set) => set.workoutExerciseId === item.id)
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({ setNumber: set.setNumber, reps: set.reps, durationSeconds: set.durationSeconds, loadKg: set.loadGrams !== null ? set.loadGrams / 1000 : null })),
      last: last.get(item.exerciseId)?.last ?? null,
    };
  });
}

