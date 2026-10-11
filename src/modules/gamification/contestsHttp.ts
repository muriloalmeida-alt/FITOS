import "server-only";
import { authErrorResponse } from "@/modules/tenancy/authContext";
import { featureEnabled } from "@/shared/config/features";
import { ContestError } from "./scoreContests";

const STATUS = { VALIDACAO: 400, PROIBIDO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

/// Rotas de contestação: 404 sem `FEATURE_GAMIFICACAO`; erros de domínio e
/// de sessão viram status.
export async function contestRoute(handler: () => Promise<Response>): Promise<Response> {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    return await handler();
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof ContestError) return Response.json({ error: error.kind, message: error.message }, { status: STATUS[error.kind] });
    throw error;
  }
}
