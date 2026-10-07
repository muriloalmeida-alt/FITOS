import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError, deleteFinishedWorkoutSession } from "@/modules/execution/sessions";
import { individualExecutor } from "../../_execution/individualExecutor";

/// Exclui um treino já realizado do próprio praticante do FitOS Livre.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteFinishedWorkoutSession({ ...(await individualExecutor()), sessionId: (await params).id });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
