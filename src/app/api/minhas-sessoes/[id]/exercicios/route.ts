import { authErrorResponse } from "@/modules/tenancy/authContext";
import { SessionError } from "@/modules/execution/sessions";
import { addExercisesToFreeSession } from "@/modules/execution/freeWorkout";
import { getLastPerformanceForExercises } from "@/modules/execution/sets";
import { toLiveItems } from "@/app/painel/_live/liveItems";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// Treino avulso: inclui os exercícios que o praticante vai fazer agora e
/// devolve os itens prontos para o treino ao vivo (com a "última vez").
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const executor = await individualExecutor();
    const body = (await request.json().catch(() => null)) as { exerciseIds?: unknown } | null;
    const exerciseIds = Array.isArray(body?.exerciseIds) ? body.exerciseIds.filter((id): id is string => typeof id === "string") : [];
    if (exerciseIds.length === 0) return Response.json({ error: "VALIDACAO", message: "Escolha ao menos um exercício." }, { status: 400 });
    const sessionId = (await params).id;
    const items = await addExercisesToFreeSession({ ...executor, sessionId, exerciseIds });
    const last = await getLastPerformanceForExercises({ ...executor, exerciseIds: items.map((item) => item.exerciseId), excludeSessionId: sessionId });
    return Response.json({ items: toLiveItems(items, [], last) }, { status: 201 });
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
