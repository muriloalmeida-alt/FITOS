import { archiveWorkout, WorkoutError } from "@/modules/workouts/workouts";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";

/// Arquiva um modelo de treino do tenant do personal autenticado.
/// Idempotente. Nunca exclusão física.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const workout = await archiveWorkout({ tenantId: ctx.tenantId, workoutId: id });
    return Response.json(workout);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
