import { requireStudent } from "@/modules/tenancy/authContext";
import { rateHandler } from "../../../_execution/handlers";

/// BK-13 (FIT-153): "Como foi o treino?" de 1 a 5, depois de concluir.
/// O personal vê no perfil do aluno e no feed do Início.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rateHandler(
    async () => {
      const ctx = await requireStudent();
      return { tenantId: ctx.tenantId, studentId: ctx.studentId };
    },
    request,
    (await params).id
  );
}
