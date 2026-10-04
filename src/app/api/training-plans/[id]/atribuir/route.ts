import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { assignTrainingPlanToStudents, WorkoutError } from "@/modules/workouts/workouts";

/// BK-03 (FIT-146): atribui o programa a vários alunos de uma vez. Cada
/// aluno recebe a própria cópia (ADR-005); o programa ativo anterior de
/// cada um é encerrado.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.studentIds) || !body.studentIds.every((value: unknown) => typeof value === "string")) {
      return Response.json({ error: "VALIDACAO", message: "Escolha os alunos." }, { status: 400 });
    }

    const assignments = await assignTrainingPlanToStudents({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      trainingPlanId: id,
      studentIds: body.studentIds,
    });
    return Response.json({ count: assignments.length }, { status: 201 });
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
