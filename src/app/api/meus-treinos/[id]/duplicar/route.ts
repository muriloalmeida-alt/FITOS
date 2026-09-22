import { duplicateWorkout, WorkoutError } from "@/modules/workouts/workouts";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";

/// Duplica um treino do workspace individual do usuário autenticado —
/// cópia independente, nunca afeta o original.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const clone = await duplicateWorkout({ tenantId: ctx.tenantId, workoutId: id });
    return Response.json(clone, { status: 201 });
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
