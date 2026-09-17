import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { removeWorkoutExercise, updateWorkoutExercise, WorkoutError } from "@/modules/workouts/workouts";

/// Edita os parâmetros de prescrição de um item do modelo.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id, itemId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const item = await updateWorkoutExercise({
      tenantId: ctx.tenantId,
      workoutId: id,
      workoutExerciseId: itemId,
      sets: body.sets === null ? null : typeof body.sets === "number" ? body.sets : undefined,
      reps: body.reps === null ? null : typeof body.reps === "number" ? body.reps : undefined,
      durationSeconds:
        body.durationSeconds === null ? null : typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
      restSeconds: body.restSeconds === null ? null : typeof body.restSeconds === "number" ? body.restSeconds : undefined,
      load: typeof body.load === "string" ? body.load : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return Response.json(item);
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

/// Remove um item do modelo — fecha o buraco de posição deixado.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id, itemId } = await params;
    await removeWorkoutExercise({ tenantId: ctx.tenantId, workoutId: id, workoutExerciseId: itemId });
    return new Response(null, { status: 204 });
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
