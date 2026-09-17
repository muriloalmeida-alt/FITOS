import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { createWorkout, WorkoutError } from "@/modules/workouts/workouts";

/// Cria um modelo de treino no tenant do personal autenticado. Ignora
/// deliberadamente qualquer `tenantId` no corpo da requisição — não há
/// esse campo na assinatura de `createWorkout`. Aluno nunca chega aqui —
/// `requirePersonal()` rejeita antes de qualquer outra coisa.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome do modelo de treino." }, { status: 400 });
    }

    const workout = await createWorkout({ tenantId: ctx.tenantId, name: body.name });
    return Response.json(workout, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
