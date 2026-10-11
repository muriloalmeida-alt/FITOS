import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { getSessionPoints } from "@/modules/gamification/sessionScoring";
import { contestStateForAuthor } from "@/modules/gamification/scoreContests";
import { featureEnabled } from "@/shared/config/features";

/// Pontos do próprio treino (Desafios): total, equilibrado, por item e se
/// já valem no placar. `null` quando o treino não foi pontuado.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const self = await requireSelfStudent();
    const sessionId = (await params).id;
    const points = await getSessionPoints(self, sessionId);
    // Contestação: o autor vê a situação e a decisão, nunca quem contestou.
    return Response.json({ points: points ? { ...points, contest: await contestStateForAuthor(self, sessionId) } : null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
