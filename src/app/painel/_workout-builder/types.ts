/// Endpoints do editor de treino. O mesmo editor serve o Personal
/// (`/api/workouts`) e o FitOS Livre (`/api/meus-treinos`, FIT-157) — só
/// muda a base das rotas.
export interface WorkoutApi {
  create: string;
  workout: (id: string) => string;
  batch: (id: string) => string;
  item: (id: string, itemId: string) => string;
  reorder: (id: string) => string;
  duplicate: (id: string) => string;
  editorHref: (id: string) => string;
  listHref: string;
}

export const PERSONAL_WORKOUT_API: WorkoutApi = {
  create: "/api/workouts",
  workout: (id) => `/api/workouts/${id}`,
  batch: (id) => `/api/workouts/${id}/itens/lote`,
  item: (id, itemId) => `/api/workouts/${id}/itens/${itemId}`,
  reorder: (id) => `/api/workouts/${id}/itens/reordenar`,
  duplicate: (id) => `/api/workouts/${id}/duplicar`,
  editorHref: (id) => `/painel/treinos/${id}`,
  listHref: "/painel/treinos",
};

/// Áreas que usam o editor. Componentes cliente recebem só a chave (string
/// serializável) e resolvem os endpoints aqui — funções não atravessam a
/// fronteira servidor → cliente.
export type WorkoutArea = "personal" | "livre";

export const LIVRE_WORKOUT_API: WorkoutApi = {
  create: "/api/meus-treinos",
  workout: (id) => `/api/meus-treinos/${id}`,
  batch: (id) => `/api/meus-treinos/${id}/itens/lote`,
  item: (id, itemId) => `/api/meus-treinos/${id}/itens/${itemId}`,
  reorder: (id) => `/api/meus-treinos/${id}/itens/reordenar`,
  duplicate: (id) => `/api/meus-treinos/${id}/duplicar`,
  editorHref: (id) => `/painel/meus-treinos/${id}`,
  listHref: "/painel/meus-treinos",
};

export function workoutApiFor(area: WorkoutArea): WorkoutApi {
  return area === "livre" ? LIVRE_WORKOUT_API : PERSONAL_WORKOUT_API;
}

export interface LibraryExercise {
  id: string;
  name: string;
  muscle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface EditorItem {
  id: string;
  exerciseId: string;
  name: string;
  muscle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface EditorWorkout {
  id: string;
  name: string;
  suggestedDays: string[];
  status: "ATIVO" | "ARQUIVADO";
  items: EditorItem[];
}

export interface ProgramOption {
  id: string;
  name: string;
  workoutCount: number;
}
