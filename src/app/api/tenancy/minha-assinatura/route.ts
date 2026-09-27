import { authErrorResponse, requireSubscriber } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { SubscriptionError, getSubscriptionForTenant, subscribeTenantToPlan } from "@/modules/billing/subscriptions";

/// Consulta a assinatura atual do tenant (ou `null`, se nunca assinou) e os
/// planos disponíveis para a audiência da sessão — nunca de um `tenantId`
/// ou audiência recebidos na requisição (FIT-122).
export async function GET() {
  try {
    const ctx = await requireSubscriber();
    const [subscription, plans] = await Promise.all([
      getSubscriptionForTenant(ctx.tenantId),
      listActivePlansForAudience(ctx.tenantType),
    ]);
    return Response.json({ subscription, plans });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Contrata ou troca o plano do tenant da sessão (FIT-122). `planId` é o
/// único dado aceito do corpo — `tenantId`/audiência sempre vêm da sessão,
/// nunca do cliente.
export async function POST(request: Request) {
  try {
    const ctx = await requireSubscriber();
    const body = await request.json().catch(() => null);
    const planId = body && typeof body === "object" && typeof body.planId === "string" ? body.planId : "";

    const subscription = await subscribeTenantToPlan({
      tenantId: ctx.tenantId,
      tenantType: ctx.tenantType,
      planId,
      actorUserId: ctx.userId,
    });
    return Response.json(subscription);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SubscriptionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "VALIDACAO" ? 400 : 409;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
