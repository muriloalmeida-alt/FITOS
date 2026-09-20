import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { updateTrainingPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Edita um plano do tenant do personal autenticado.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const plan = await updateTrainingPlan({
      tenantId: ctx.tenantId,
      trainingPlanId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      durationWeeks:
        body.durationWeeks === null ? null : typeof body.durationWeeks === "number" ? body.durationWeeks : undefined,
    });

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
