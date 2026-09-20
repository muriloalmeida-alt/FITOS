import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { completeWorkoutSession, SessionError } from "@/modules/execution/sessions";

/// Conclui a sessão do próprio aluno (FIT-041). Rejeita se a sessão já
/// não estiver em andamento — nunca "conclui de novo" silenciosamente.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const session = await completeWorkoutSession({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id });
    return Response.json(session);
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
