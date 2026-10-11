import { requireStudent } from "@/modules/tenancy/authContext";
import { blockTimerHandler } from "../../../../../_execution/handlers";

const executor = async () => {
  const ctx = await requireStudent();
  return { tenantId: ctx.tenantId, studentId: ctx.studentId };
};

/// Timer do bloco do aluno (iniciar, pausar, retomar).
export async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  return blockTimerHandler(executor, request, id, key);
}
