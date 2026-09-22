import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { completeWorkoutSession, SessionError } from "@/modules/execution/sessions";

/// Conclui a sessão do próprio praticante individual (FIT-103). Rejeita
/// se a sessão já não estiver em andamento — nunca "conclui de novo"
/// silenciosamente.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const session = await completeWorkoutSession({ tenantId: ctx.tenantId, studentId: student.id, sessionId: id });
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
