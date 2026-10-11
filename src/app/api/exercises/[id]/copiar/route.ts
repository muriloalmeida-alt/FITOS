import { copyCatalogExerciseAsOwn, ExerciseError } from "@/modules/exercises/exercises";
import { authErrorResponse, requireSubscriber } from "@/modules/tenancy/authContext";

/// BK-08 (FIT-147): "Criar uma versão minha" de um exercício da biblioteca
/// global. Devolve o exercício próprio criado.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSubscriber();
    const { id } = await params;
    const exercise = await copyCatalogExerciseAsOwn({ tenantId: ctx.tenantId, actorUserId: ctx.userId, exerciseId: id });
    return Response.json(exercise, { status: 201 });
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
