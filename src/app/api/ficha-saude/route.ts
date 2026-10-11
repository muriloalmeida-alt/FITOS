import { requireStudent } from "@/modules/tenancy/authContext";
import { saveHealthForm } from "@/modules/students/healthForm";
import { healthFormErrorResponse } from "@/modules/students/healthFormErrors";

/// O aluno responde a própria ficha de saúde (EPIC-46).
export async function PUT(request: Request) {
  try {
    const ctx = await requireStudent();
    const body = await request.json().catch(() => null);
    const saved = await saveHealthForm({ tenantId: ctx.tenantId, studentId: ctx.studentId, actorUserId: ctx.userId, answers: body });
    return Response.json({ parqYes: saved.parqYes });
  } catch (error) {
    return healthFormErrorResponse(error);
  }
}
