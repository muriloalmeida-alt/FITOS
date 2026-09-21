import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { assignTrainingPlanToStudent, unassignTrainingPlanFromStudent, WorkoutError } from "@/modules/workouts/workouts";

/// Atribui um plano do tenant ao aluno (FIT-033). Encerra automaticamente
/// qualquer atribuição ativa anterior do mesmo aluno — ver
/// `assignTrainingPlanToStudent`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body.trainingPlanId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o plano a atribuir." }, { status: 400 });
    }

    const assignment = await assignTrainingPlanToStudent({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      studentId: id,
      trainingPlanId: body.trainingPlanId,
    });
    return Response.json(assignment, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}

/// Encerra a atribuição ativa do aluno, sem substituir por outra
/// (FIT-033). Idempotente — sem atribuição ativa, apenas retorna `null`.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;

    const ended = await unassignTrainingPlanFromStudent({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      studentId: id,
    });
    return Response.json(ended);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof WorkoutError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
