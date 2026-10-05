import { authErrorResponse } from "@/modules/tenancy/authContext";
import { StudentChargeError } from "@/modules/student-finance/charges";

/// 401/403 da sessão e erros de cobrança (404/400).
export function chargeErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof StudentChargeError) {
    return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
  }
  throw error;
}
