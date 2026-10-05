import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { PreferredDaysError, setPreferredDays } from "@/modules/students/preferredDays";

/// "Meus dias" do aluno ou do praticante (EPIC-31). Aluno com personal:
/// o personal é avisado da mudança.
export async function PATCH(request: Request) {
  try {
    const ctx = await requireSelfStudent();
    const body = await request.json().catch(() => null);
    const result = await setPreferredDays({ tenantId: ctx.tenantId, studentId: ctx.studentId, days: body?.days, notifyPersonal: ctx.role === "ALUNO" });
    return Response.json(result);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof PreferredDaysError) {
      return Response.json({ error: "VALIDACAO", message: error.message }, { status: 400 });
    }
    throw error;
  }
}
