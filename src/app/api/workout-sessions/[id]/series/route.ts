import { requireStudent } from "@/modules/tenancy/authContext";
import { recordSetHandler, removeSetHandler } from "../../../_execution/handlers";

const executor = async () => {
  const ctx = await requireStudent();
  return { tenantId: ctx.tenantId, studentId: ctx.studentId };
};

/// BK-11 (FIT-153): "Série feita" do aluno; responde se foi recorde (BK-12).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return recordSetHandler(executor, request, (await params).id);
}

/// Desfaz uma série marcada por engano.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return removeSetHandler(executor, request, (await params).id);
}
