import { authErrorResponse } from "@/modules/tenancy/authContext";
import { RankingError } from "@/modules/gamification/classRanking";

/// 401/403 da sessão e erros do ranking da turma.
export function rankingErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof RankingError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "PROIBIDO" ? 403 : 409 });
  throw error;
}
