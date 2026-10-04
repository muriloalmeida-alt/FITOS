import "server-only";
import { listCatalogExercisesForPicker } from "@/modules/exercises/exercises";
import { getWorkoutForTenant, listTrainingPlanSummariesForTenant, listWorkoutExercisesForWorkout } from "@/modules/workouts/workouts";
import type { EditorWorkout, LibraryExercise, ProgramOption } from "../_workout-builder/types";

/// Dados do editor de treino (FIT-146): biblioteca visível ao tenant e,
/// para o Personal, os programas ativos para "Colocar em um programa".
export async function loadLibrary(tenantId: string): Promise<LibraryExercise[]> {
  return listCatalogExercisesForPicker({ tenantId });
}

export async function loadPrograms(tenantId: string): Promise<ProgramOption[]> {
  const plans = await listTrainingPlanSummariesForTenant({ tenantId });
  return plans.map((plan) => ({ id: plan.id, name: plan.name, workoutCount: plan.workoutCount }));
}

/// Treino com os exercícios no formato do editor; `null` se não for do tenant.
export async function loadEditorWorkout(tenantId: string, workoutId: string): Promise<EditorWorkout | null> {
  const workout = await getWorkoutForTenant({ tenantId, workoutId });
  if (!workout) return null;
  const items = await listWorkoutExercisesForWorkout({ tenantId, workoutId });
  return {
    id: workout.id,
    name: workout.name,
    suggestedDays: workout.suggestedDays,
    status: workout.status,
    items: items.map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      name: item.exercise.name,
      muscle: item.exercise.muscle,
      imageUrl: item.exercise.imageUrl,
      imageAlt: item.exercise.imageAlt,
      sets: item.sets,
      reps: item.reps,
      durationSeconds: item.durationSeconds,
      load: item.load,
      restSeconds: item.restSeconds,
      notes: item.notes,
    })),
  };
}
