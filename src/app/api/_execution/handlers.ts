import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError, completeWorkoutSession, rateWorkoutSession } from "@/modules/execution/sessions";
import { getSessionSummary, recordWorkoutSet, removeWorkoutSet } from "@/modules/execution/sets";

/// Handlers da execução por série (FIT-153 aluno, FIT-158 FitOS Livre).
/// Cada rota só informa como achar o executor da sessão (aluno ou o
/// próprio praticante); nunca aceita `studentId` do cliente.
export type ResolveExecutor = () => Promise<{ tenantId: string; studentId: string }>;

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

function validSetBody(body: unknown): body is { workoutExerciseId: string; setNumber: number } & Record<string, unknown> {
  return !!body && typeof body === "object" && typeof (body as { workoutExerciseId?: unknown }).workoutExerciseId === "string" && typeof (body as { setNumber?: unknown }).setNumber === "number";
}

export async function recordSetHandler(resolve: ResolveExecutor, request: Request, sessionId: string): Promise<Response> {
  try {
    const executor = await resolve();
    const body = await request.json().catch(() => null);
    if (!validSetBody(body)) return Response.json({ error: "VALIDACAO", message: "Informe o exercício e a série." }, { status: 400 });
    const result = await recordWorkoutSet({
      ...executor,
      sessionId,
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

export async function removeSetHandler(resolve: ResolveExecutor, request: Request, sessionId: string): Promise<Response> {
  try {
    const executor = await resolve();
    const body = await request.json().catch(() => null);
    if (!validSetBody(body)) return Response.json({ error: "VALIDACAO", message: "Informe o exercício e a série." }, { status: 400 });
    await removeWorkoutSet({ ...executor, sessionId, workoutExerciseId: body.workoutExerciseId, setNumber: body.setNumber });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function rateHandler(resolve: ResolveExecutor, request: Request, sessionId: string): Promise<Response> {
  try {
    const executor = await resolve();
    const body = await request.json().catch(() => null);
    const perceivedEffort = body && typeof body.perceivedEffort === "number" ? body.perceivedEffort : NaN;
    await rateWorkoutSession({ ...executor, sessionId, perceivedEffort });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function completeHandler(resolve: ResolveExecutor, request: Request, sessionId: string): Promise<Response> {
  try {
    const executor = await resolve();
    const body = await request.json().catch(() => null);
    const activeSeconds = body && typeof body.activeSeconds === "number" ? Math.round(body.activeSeconds) : null;
    const session = await completeWorkoutSession({ ...executor, sessionId, activeSeconds });
    const summary = await getSessionSummary({ ...executor, sessionId });
    return Response.json({ ...session, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
