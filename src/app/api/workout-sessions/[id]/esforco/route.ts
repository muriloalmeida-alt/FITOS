import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { SessionError, rateWorkoutSession } from "@/modules/execution/sessions";

/// BK-13 (FIT-153): "Como foi o treino?" de 1 a 5, depois de concluir.
/// O personal vê no perfil do aluno e no feed do Início.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireStudent();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const perceivedEffort = body && typeof body.perceivedEffort === "number" ? body.perceivedEffort : NaN;
    await rateWorkoutSession({ tenantId: ctx.tenantId, studentId: ctx.studentId, sessionId: id, perceivedEffort });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
