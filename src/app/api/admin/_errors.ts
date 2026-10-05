import { authErrorResponse } from "@/modules/tenancy/authContext";
import { AdminError } from "@/modules/admin/users";

/// 401/403 da sessão e erros de domínio da administração.
export function adminErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof AdminError) {
    const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "PROIBIDO" ? 403 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  throw error;
}
