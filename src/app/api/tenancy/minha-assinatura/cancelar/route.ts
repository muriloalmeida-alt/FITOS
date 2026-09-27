import { authErrorResponse, requireSubscriber } from "@/modules/tenancy/authContext";
import { SubscriptionError, cancelSubscription } from "@/modules/billing/subscriptions";

/// Cancela a assinatura do tenant da sessão (FIT-122) — exige motivo,
/// idempotente (cancelar de novo é um no-op silencioso).
export async function POST(request: Request) {
  try {
    const ctx = await requireSubscriber();
    const body = await request.json().catch(() => null);
    const reason = body && typeof body === "object" && typeof body.reason === "string" ? body.reason : "";

    const subscription = await cancelSubscription({ tenantId: ctx.tenantId, actorUserId: ctx.userId, reason });
    return Response.json(subscription);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SubscriptionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
