import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { SessionError, startOrResumeWorkoutSession } from "@/modules/execution/sessions";

/// Inicia ou retoma (FIT-041) a sessão do próprio aluno da sessão
/// autenticada — nunca aceita `studentId` do cliente. `workoutId` precisa
/// pertencer ao plano-snapshot da atribuição ativa do aluno.
export async function POST(request: Request) {
  try {
    const ctx = await requireStudent();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.workoutId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o treino a iniciar." }, { status: 400 });
    }

    const session = await startOrResumeWorkoutSession({
      tenantId: ctx.tenantId,
      studentId: ctx.studentId,
      workoutId: body.workoutId,
    });
    return Response.json(session, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
