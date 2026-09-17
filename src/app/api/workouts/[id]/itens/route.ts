import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { addWorkoutExercise, WorkoutError } from "@/modules/workouts/workouts";

/// Adiciona um exercício ao modelo de treino do tenant do personal
/// autenticado, na próxima posição disponível.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.exerciseId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o exercício." }, { status: 400 });
    }

    const item = await addWorkoutExercise({
      tenantId: ctx.tenantId,
      workoutId: id,
      exerciseId: body.exerciseId,
      sets: typeof body.sets === "number" ? body.sets : undefined,
      reps: typeof body.reps === "number" ? body.reps : undefined,
      durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
      load: typeof body.load === "string" ? body.load : undefined,
      restSeconds: typeof body.restSeconds === "number" ? body.restSeconds : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return Response.json(item, { status: 201 });
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
