import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { SessionError, startOrResumeIndividualWorkoutSession } from "@/modules/execution/sessions";

/// Inicia ou retoma (FIT-103) a sessão do próprio praticante individual
/// — nunca aceita `studentId` do cliente. `workoutId` precisa pertencer
/// ao próprio tenant e estar ATIVO (nenhuma atribuição, papel que não
/// existe sem personal — ver `sessions.ts`).
export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.workoutId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o treino a iniciar." }, { status: 400 });
    }

    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const session = await startOrResumeIndividualWorkoutSession({
      tenantId: ctx.tenantId,
      studentId: student.id,
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
