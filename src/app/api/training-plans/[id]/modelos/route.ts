import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { moveWorkoutToPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Adiciona um modelo de treino existente ao plano — por construção, isso
/// move o modelo do plano onde estava para este (ver `moveWorkoutToPlan`).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.workoutId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o modelo a adicionar." }, { status: 400 });
    }

    const workout = await moveWorkoutToPlan({
      tenantId: ctx.tenantId,
      workoutId: body.workoutId,
      targetTrainingPlanId: id,
    });
    return Response.json(workout, { status: 201 });
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
