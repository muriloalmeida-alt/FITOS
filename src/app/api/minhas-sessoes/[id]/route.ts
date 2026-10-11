import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError, deleteFinishedWorkoutSession } from "@/modules/execution/sessions";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";

/// Exclui um treino já realizado de quem treina, deixando a versão excluída
/// na trilha. Livre: qualquer treino seu; aluno: só os que ele registrou.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const self = await requireSelfStudent();
    await deleteFinishedWorkoutSession({ tenantId: self.tenantId, studentId: self.studentId, actorUserId: self.userId, onlyRetroactive: self.role === "ALUNO", sessionId: (await params).id });
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
