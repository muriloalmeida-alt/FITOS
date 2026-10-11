import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { createGoal, GoalError } from "@/modules/evolution/goals";

/// Meta escolhida entre as sugestões (EPIC-30), pelo aluno ou praticante.
export async function POST(request: Request) {
  try {
    const ctx = await requireSelfStudent();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.description !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Escolha uma meta." }, { status: 400 });
    }
    const targetDate = typeof body.targetDate === "string" ? new Date(body.targetDate) : null;
    if (targetDate && Number.isNaN(targetDate.getTime())) {
      return Response.json({ error: "VALIDACAO", message: "Data-alvo inválida." }, { status: 400 });
    }
    const goal = await createGoal({ tenantId: ctx.tenantId, studentId: ctx.studentId, description: body.description, targetDate });
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
