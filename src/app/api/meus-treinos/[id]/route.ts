import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { updateWorkout, WorkoutError } from "@/modules/workouts/workouts";

/// Edita um treino do workspace individual do usuário autenticado: nome e,
/// desde a BK-16 (FIT-156/157), os dias sugeridos — base do "Hoje para
/// você". Aceita só o que veio (o editor salva um campo por vez).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || (typeof body.name !== "string" && !Array.isArray(body.suggestedDays))) {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome ou os dias do treino." }, { status: 400 });
    }

    const workout = await updateWorkout({
      tenantId: ctx.tenantId,
      workoutId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      suggestedDays: Array.isArray(body.suggestedDays) ? body.suggestedDays.filter((day: unknown) => typeof day === "string") : undefined,
    });
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
