import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { endStudentBond, StudentError } from "@/modules/students/students";

/// Encerra definitivamente o vínculo do personal autenticado com o aluno
/// (FIT-106). Idempotente — encerrar de novo um vínculo já encerrado só
/// retorna o estado atual, sem sobrescrever data/motivo originais.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : null;

    const student = await endStudentBond({ tenantId: ctx.tenantId, studentId: id, actorUserId: ctx.userId, reason });
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
