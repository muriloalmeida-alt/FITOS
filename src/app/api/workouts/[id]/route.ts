import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { updateWorkout, WorkoutError } from "@/modules/workouts/workouts";

/// Edita um modelo de treino do tenant do personal autenticado. O `id`
/// vem da URL, mas `updateWorkout` sempre exige `tenantId` da sessão — um
/// `id` de outro tenant nunca é encontrado (nem revelado).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const workout = await updateWorkout({
      tenantId: ctx.tenantId,
      workoutId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      suggestedDays: Array.isArray(body.suggestedDays)
        ? body.suggestedDays.filter((day: unknown) => typeof day === "string")
        : undefined,
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
