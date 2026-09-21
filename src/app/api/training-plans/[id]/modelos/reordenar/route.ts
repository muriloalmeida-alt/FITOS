import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { reorderWorkoutsInPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Reordena os modelos dentro do plano conforme a lista de ids enviada.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (
      !body ||
      !Array.isArray(body.orderedWorkoutIds) ||
      !body.orderedWorkoutIds.every((item: unknown) => typeof item === "string")
    ) {
      return Response.json({ error: "VALIDACAO", message: "Informe a lista de ids na nova ordem." }, { status: 400 });
    }

    await reorderWorkoutsInPlan({ tenantId: ctx.tenantId, trainingPlanId: id, orderedWorkoutIds: body.orderedWorkoutIds });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
