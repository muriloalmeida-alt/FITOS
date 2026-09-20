import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { removeWorkoutFromPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Remove um modelo do plano — move-o de volta para o plano rascunho do
/// tenant, nunca exclui nem arquiva o modelo.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; workoutId: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id, workoutId } = await params;
    const workout = await removeWorkoutFromPlan({ tenantId: ctx.tenantId, workoutId, trainingPlanId: id });
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
