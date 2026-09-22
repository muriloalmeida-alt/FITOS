import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { recordSessionResult, SessionError } from "@/modules/execution/sessions";

function normalizeNumberField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/// Registra (ou substitui, nunca duplica) o resultado executado de um
/// item da sessão do próprio praticante individual (FIT-103) — mesmo
/// upsert por `[workoutSessionId, workoutExerciseId]` do FIT-041.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.workoutExerciseId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o item do treino." }, { status: 400 });
    }

    const setsCompleted = normalizeNumberField(body.setsCompleted);
    const repsCompleted = normalizeNumberField(body.repsCompleted);
    const durationSecondsCompleted = normalizeNumberField(body.durationSecondsCompleted);
    if (Number.isNaN(setsCompleted) || Number.isNaN(repsCompleted) || Number.isNaN(durationSecondsCompleted)) {
      return Response.json({ error: "VALIDACAO", message: "Valores numéricos inválidos." }, { status: 400 });
    }
    const loadUsed = body.loadUsed === undefined || body.loadUsed === null ? null : String(body.loadUsed);

    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const result = await recordSessionResult({
      tenantId: ctx.tenantId,
      studentId: student.id,
      sessionId: id,
      workoutExerciseId: body.workoutExerciseId,
      setsCompleted: setsCompleted ?? null,
      repsCompleted: repsCompleted ?? null,
      durationSecondsCompleted: durationSecondsCompleted ?? null,
      loadUsed,
    });
    return Response.json(result, { status: 200 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
