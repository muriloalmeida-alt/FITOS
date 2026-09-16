import { ExerciseError, reactivateExercise } from "@/modules/exercises/exercises";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";

/// Reativa um exercício próprio do tenant do personal autenticado.
/// Idempotente pela mesma razão da rota de arquivar.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const exercise = await reactivateExercise({ tenantId: ctx.tenantId, exerciseId: id, actorUserId: ctx.userId });
    return Response.json(exercise);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof ExerciseError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
