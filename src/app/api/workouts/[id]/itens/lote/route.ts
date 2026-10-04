import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { addWorkoutExercisesBatch, WorkoutError } from "@/modules/workouts/workouts";

/// BK-01 (FIT-146): adiciona vários exercícios de uma vez ao treino, com a
/// prescrição padrão (3 × 12, 60 s). Ou entram todos, ou nenhum.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.exerciseIds) || !body.exerciseIds.every((value: unknown) => typeof value === "string")) {
      return Response.json({ error: "VALIDACAO", message: "Informe os exercícios." }, { status: 400 });
    }

    const items = await addWorkoutExercisesBatch({ tenantId: ctx.tenantId, workoutId: id, exerciseIds: body.exerciseIds });
    return Response.json(items, { status: 201 });
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
