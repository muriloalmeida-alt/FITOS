import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { AssessmentError, softDeleteAssessment } from "@/modules/evolution/assessments";

/// Exclusão lógica da própria autoavaliação (FIT-104) — mesmo padrão de
/// `softDeleteAssessment` (FIT-042), `actorUserId` é sempre o próprio
/// usuário autenticado.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const assessment = await softDeleteAssessment({ tenantId: ctx.tenantId, actorUserId: ctx.userId, assessmentId: id });
    return Response.json(assessment);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 404 });
    }
    throw error;
  }
}
