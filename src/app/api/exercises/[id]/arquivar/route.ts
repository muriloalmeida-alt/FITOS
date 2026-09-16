import { archiveExercise, ExerciseError } from "@/modules/exercises/exercises";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";

/// Arquiva um exercício próprio do tenant do personal autenticado.
/// Idempotente — se já estiver arquivado, apenas retorna o estado atual
/// (sem erro). Nunca exclusão física.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const exercise = await archiveExercise({ tenantId: ctx.tenantId, exerciseId: id, actorUserId: ctx.userId });
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
