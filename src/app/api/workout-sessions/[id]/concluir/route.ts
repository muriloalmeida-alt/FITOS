import { requireStudent } from "@/modules/tenancy/authContext";
import { completeHandler } from "../../../_execution/handlers";

/// Conclui a sessão do próprio aluno (FIT-041). Rejeita se a sessão já
/// não estiver em andamento — nunca "conclui de novo" silenciosamente.
/// FIT-153: aceita `activeSeconds` (BK-14) e devolve o resumo do treino.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return completeHandler(
    async () => {
      const ctx = await requireStudent();
      return { tenantId: ctx.tenantId, studentId: ctx.studentId };
    },
    request,
    (await params).id
  );
}
