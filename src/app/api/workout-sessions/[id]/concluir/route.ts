import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { completeWorkoutSession, SessionError } from "@/modules/execution/sessions";
import { getSessionSummary } from "@/modules/execution/sets";

/// Conclui a sessão do próprio aluno (FIT-041). Rejeita se a sessão já
/// não estiver em andamento — nunca "conclui de novo" silenciosamente.
/// FIT-153: aceita `activeSeconds` (BK-14) e devolve o resumo do treino.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const activeSeconds = body && typeof body.activeSeconds === "number" ? Math.round(body.activeSeconds) : null;
    const session = await completeWorkoutSession({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id, activeSeconds });
    const summary = await getSessionSummary({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id });
    return Response.json({ ...session, summary });
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
