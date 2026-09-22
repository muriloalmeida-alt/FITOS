import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { createWorkout, WorkoutError } from "@/modules/workouts/workouts";

/// Cria um treino no workspace individual do usuário autenticado (FIT-102).
/// Reaproveita `createWorkout` (mesmo módulo do personal, FIT-030) sem
/// nenhuma alteração — a função só depende de `tenantId`, nunca de papel.
/// Ignora deliberadamente qualquer `tenantId` no corpo da requisição.
export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome do treino." }, { status: 400 });
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
