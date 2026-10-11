import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError } from "@/modules/execution/sessions";
import { getFreeWorkoutQuality } from "@/modules/execution/freeWorkout";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// Avaliação do treino avulso concluído: áreas mais exigidas, as que
/// ficaram devendo e a nota de 1 a 5.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const quality = await getFreeWorkoutQuality({ ...(await individualExecutor()), sessionId: (await params).id });
    return Response.json(quality);
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
