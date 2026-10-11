import { requirePersonal } from "@/modules/tenancy/authContext";
import { saveHealthForm } from "@/modules/students/healthForm";
import { healthFormErrorResponse } from "@/modules/students/healthFormErrors";

/// O personal preenche a ficha de saúde pelo aluno (EPIC-46), por exemplo
/// na primeira conversa presencial.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const saved = await saveHealthForm({ tenantId: ctx.tenantId, studentId: (await params).id, actorUserId: ctx.userId, answers: body });
    return Response.json({ parqYes: saved.parqYes });
  } catch (error) {
    return healthFormErrorResponse(error);
  }
}
