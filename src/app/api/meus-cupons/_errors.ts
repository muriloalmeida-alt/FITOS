import { authErrorResponse } from "@/modules/tenancy/authContext";
import { CouponRedemptionError } from "@/modules/billing/couponRedemptions";
import { featureEnabled } from "@/shared/config/features";

/// Cupons (feature 5) só existem com `FEATURE_CUPONS=on`.
export function couponsOff(): Response | null {
  return featureEnabled("CUPONS") ? null : Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
}

/// Erros do resgate com os códigos do contrato (INVALID_CODE, EXPIRED…).
export function couponErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof CouponRedemptionError) {
    const status = error.kind === "QUOTE_STALE" || error.kind === "CONFLICT" || error.kind === "CAP_REACHED" || error.kind === "ALREADY_USED" ? 409 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  throw error;
}
