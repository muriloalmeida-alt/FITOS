import { archiveTrainingPlan, WorkoutError } from "@/modules/workouts/workouts";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";

/// Arquiva um plano do tenant do personal autenticado. Idempotente. Nunca
/// exclusão física; os modelos agrupados permanecem intactos.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const plan = await archiveTrainingPlan({ tenantId: ctx.tenantId, trainingPlanId: id });
    return Response.json(plan);
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
