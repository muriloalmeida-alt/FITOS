import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { SessionError } from "@/modules/execution/sessions";
import { recordWorkoutSet, removeWorkoutSet } from "@/modules/execution/sets";

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function errorResponse(error: unknown): Response {
  const response = authErrorResponse(error);
  if (response) return response;
  if (error instanceof SessionError) {
    const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  throw error;
}

/// BK-11 (FIT-153): "Série feita" — grava uma série da sessão do próprio
/// aluno. Responde se foi recorde (BK-12).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.workoutExerciseId !== "string" || typeof body.setNumber !== "number") {
      return Response.json({ error: "VALIDACAO", message: "Informe o exercício e a série." }, { status: 400 });
    }
    const result = await recordWorkoutSet({
      tenantId: ctx.tenantId,
      studentId: ctx.studentId,
      sessionId: id,
      workoutExerciseId: body.workoutExerciseId,
      setNumber: body.setNumber,
      reps: numberOrNull(body.reps),
      durationSeconds: numberOrNull(body.durationSeconds),
      loadKg: numberOrNull(body.loadKg),
    });
    return Response.json({ setNumber: result.set.setNumber, personalRecord: result.personalRecord }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/// Desfaz uma série marcada por engano.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.workoutExerciseId !== "string" || typeof body.setNumber !== "number") {
      return Response.json({ error: "VALIDACAO", message: "Informe o exercício e a série." }, { status: 400 });
    }
    await removeWorkoutSet({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id, workoutExerciseId: body.workoutExerciseId, setNumber: body.setNumber });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
