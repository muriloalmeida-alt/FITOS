import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { reactivateStudent, StudentError } from "@/modules/students/students";

/// Reativa um aluno do tenant do personal autenticado. Idempotente — se já
/// estiver ativo, apenas retorna o estado atual (sem erro). Não restaura
/// nenhum convite expirado/cancelado (não há convites nesta História).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const student = await reactivateStudent({ tenantId: ctx.tenantId, studentId: id, actorUserId: ctx.userId });
    return Response.json(student);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
