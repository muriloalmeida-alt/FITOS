import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { addWorkoutToPlan, WorkoutError } from "@/modules/workouts/workouts";

/// Adiciona um modelo de treino existente ao plano (FIT-146,
/// `addWorkoutToPlan`): treino de "Meus modelos" é movido; treino que já
/// está em outro programa é copiado, para não sumir do programa de origem.
/// Responde `{ ...workout, copied }`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.workoutId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o modelo a adicionar." }, { status: 400 });
    }

    const { workout, copied } = await addWorkoutToPlan({
      tenantId: ctx.tenantId,
      workoutId: body.workoutId,
      targetTrainingPlanId: id,
    });
    return Response.json({ ...workout, copied }, { status: 201 });
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
