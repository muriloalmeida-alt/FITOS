import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { abandonWorkoutSession, SessionError } from "@/modules/execution/sessions";

/// Abandona a sessão do próprio aluno (FIT-041). Mesma validação de
/// `concluir` — os resultados já registrados permanecem.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const session = await abandonWorkoutSession({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id });
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
