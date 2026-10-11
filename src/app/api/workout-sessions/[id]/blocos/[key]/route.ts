import { requireStudent } from "@/modules/tenancy/authContext";
import { blockResultHandler } from "../../../../_execution/handlers";

const executor = async () => {
  const ctx = await requireStudent();
  return { tenantId: ctx.tenantId, studentId: ctx.studentId };
};

/// Resultado do bloco do aluno (encerra o bloco; reenviar corrige).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  return blockResultHandler(executor, request, id, key);
}
