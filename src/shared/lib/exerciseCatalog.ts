/// Funcional e CrossFit (feature 1): categorias, métrica de registro e a
/// busca do catálogo. Puro (sem Prisma), usado no servidor e na biblioteca
/// do editor de treino.

export const EXERCISE_CATEGORIES = ["Funcional", "CrossFit"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export function isExerciseCategory(value: unknown): value is ExerciseCategory {
  return typeof value === "string" && (EXERCISE_CATEGORIES as readonly string[]).includes(value);
}

/// Como o exercício é registrado (material de referência, coluna "Registro").
export const EXERCISE_METRICS = {
  REPS: "Repetições",
  REPS_LOAD: "Repetições + carga",
  REPS_RESISTANCE: "Repetições + resistência",
  HOLD: "Sustentação",
  DISTANCE_LOAD: "Distância + carga",
  DISTANCE_OR_CALORIES: "Distância ou calorias",
} as const;

export function metricLabel(metric: string | null | undefined): string | null {
  return metric && metric in EXERCISE_METRICS ? EXERCISE_METRICS[metric as keyof typeof EXERCISE_METRICS] : null;
}

/// Minúsculas e sem acento: "Tríceps" e "triceps" se encontram.
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

interface Searchable {
  name: string;
  aliases?: string[] | null;
  muscle?: string | null;
  secondaryMuscles?: string[] | null;
}

/// Texto da busca: nome, nomes alternativos e músculos (principal e
/// secundários). A migração `funcional_catalogo` aplica a mesma regra em SQL.
export function exerciseSearchText(exercise: Searchable): string {
  return normalizeSearch([exercise.name, ...(exercise.aliases ?? []), exercise.muscle ?? "", ...(exercise.secondaryMuscles ?? [])].filter(Boolean).join(" "));
}

export function matchesSearch(exercise: Searchable, query: string): boolean {
  const q = normalizeSearch(query);
  return !q || exerciseSearchText(exercise).includes(q);
}

/// O músculo escolhido no filtro vale como principal ou secundário.
export function worksMuscle(exercise: { muscle?: string | null; secondaryMuscles?: string[] | null }, muscle: string): boolean {
  return exercise.muscle === muscle || (exercise.secondaryMuscles ?? []).includes(muscle);
}
