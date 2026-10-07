import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError } from "@/modules/execution/sessions";
import { saveFreeWorkout } from "@/modules/execution/freeWorkout";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// "Salvar nos meus treinos": o treino avulso concluído vira um treino
/// montado, com o que foi feito.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const executor = await individualExecutor();
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const workout = await saveFreeWorkout({ ...executor, sessionId: (await params).id, name: typeof body?.name === "string" ? body.name : null });
    return Response.json({ workoutId: workout.id, name: workout.name });
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
