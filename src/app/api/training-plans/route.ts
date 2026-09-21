import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { createTrainingPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Cria um plano semanal no tenant do personal autenticado. Ignora
/// deliberadamente qualquer `tenantId` no corpo da requisição.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome do plano." }, { status: 400 });
    }

    const plan = await createTrainingPlan({
      tenantId: ctx.tenantId,
      name: body.name,
      durationWeeks: typeof body.durationWeeks === "number" ? body.durationWeeks : undefined,
    });
    return Response.json(plan, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
