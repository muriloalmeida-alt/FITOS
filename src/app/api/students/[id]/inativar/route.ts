import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { inactivateStudent, StudentError } from "@/modules/students/students";

/// Inativa um aluno do tenant do personal autenticado. Idempotente — se já
/// estiver inativo, apenas retorna o estado atual (sem erro).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const student = await inactivateStudent({ tenantId: ctx.tenantId, studentId: id, actorUserId: ctx.userId });
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
