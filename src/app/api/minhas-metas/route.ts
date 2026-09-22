import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { createGoal, GoalError, listGoalsForStudent } from "@/modules/evolution/goals";

/// Metas pessoais do próprio praticante individual (FIT-104) — nunca
/// aceita `studentId` do cliente, sempre a auto-referência.
export async function GET() {
  try {
    const ctx = await requireIndividual();
    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const goals = await listGoalsForStudent({ tenantId: ctx.tenantId, studentId: student.id });
    return Response.json(goals);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.description !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe a descrição da meta." }, { status: 400 });
    }
    if (body.targetDate !== null && body.targetDate !== undefined && typeof body.targetDate !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Data-alvo inválida." }, { status: 400 });
    }

    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const goal = await createGoal({
      tenantId: ctx.tenantId,
      studentId: student.id,
      description: body.description,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
    });
    return Response.json(goal, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof GoalError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
