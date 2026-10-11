import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { AssessmentError, createAssessment } from "@/modules/evolution/assessments";

/// Pesagem do próprio aluno ou praticante (EPIC-30), autorada por quem se
/// pesou. O aluno registra só o peso (gordura e medidas continuam com o
/// personal); o FitOS Livre pode incluir o % de gordura.
export async function POST(request: Request) {
  try {
    const ctx = await requireSelfStudent();
    const body = await request.json().catch(() => null);
    const weightKg = Number(body?.weightKg);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
      return Response.json({ error: "VALIDACAO", message: "Informe um peso válido." }, { status: 400 });
    }
    const assessment = await createAssessment({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      studentId: ctx.studentId,
      weightKg: Math.round(weightKg * 10) / 10,
      bodyFatPercent: ctx.role === "INDIVIDUAL" && body?.bodyFatPercent != null && Number.isFinite(Number(body.bodyFatPercent)) ? Number(body.bodyFatPercent) : null,
      notes: null,
      measurementsCm: [],
    });
    return Response.json({ id: assessment.id }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
