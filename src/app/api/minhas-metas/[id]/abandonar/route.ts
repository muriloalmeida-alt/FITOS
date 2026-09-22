import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { abandonGoal, GoalError } from "@/modules/evolution/goals";

/// Abandona uma meta EM_ANDAMENTO do próprio praticante individual (FIT-104).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireIndividual();
    const { id } = await params;
    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const goal = await abandonGoal({ tenantId: ctx.tenantId, studentId: student.id, goalId: id });
    return Response.json(goal);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof GoalError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
