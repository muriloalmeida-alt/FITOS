import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { AssessmentError, softDeleteAssessment } from "@/modules/evolution/assessments";

/// Exclusão lógica de uma avaliação (FIT-042) — nunca física; idempotente.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { assessmentId } = await params;
    const assessment = await softDeleteAssessment({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      assessmentId,
    });
    return Response.json(assessment);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AssessmentError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
