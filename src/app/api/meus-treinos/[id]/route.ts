import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { updateWorkout, WorkoutError } from "@/modules/workouts/workouts";

/// Renomeia um treino do workspace individual do usuário autenticado. Sem
/// `suggestedDays` (conceito de agenda do personal/aluno, sem uso aqui —
/// o praticante decide quando treina, não é atribuído a dias sugeridos).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome do treino." }, { status: 400 });
    }

    const workout = await updateWorkout({ tenantId: ctx.tenantId, workoutId: id, name: body.name });
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
