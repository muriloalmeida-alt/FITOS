import { requirePersonal } from "@/modules/tenancy/authContext";
import { restoreStudentCopy } from "@/modules/library/studentCopy";
import { workoutErrorResponse } from "../../../../_workoutErrors";

/// Desfazer um ajuste: volta para a versão anterior da cópia (ADR-016).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (typeof body?.planId !== "string") return Response.json({ error: "VALIDACAO", message: "Versão inválida." }, { status: 400 });
    await restoreStudentCopy({ tenantId: ctx.tenantId, actorUserId: ctx.userId, studentId: id, planId: body.planId });
    return new Response(null, { status: 204 });
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
