import { authErrorResponse } from "@/modules/tenancy/authContext";
import { WorkoutError } from "@/modules/workouts/workouts";

/// 401/403 da sessão e erros de domínio de treino (404/400).
export function workoutErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof WorkoutError) {
    const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  throw error;
}
