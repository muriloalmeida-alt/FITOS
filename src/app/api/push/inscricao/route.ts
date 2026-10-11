import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { isSubscriptionInput, removeSubscription, saveSubscription } from "@/modules/notifications/push";

/// Este aparelho passa a receber notificações (EPIC-31).
export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    if (!isSubscriptionInput(body?.subscription)) {
      return Response.json({ error: "VALIDACAO", message: "Inscrição de notificação inválida." }, { status: 400 });
    }
    await saveSubscription({ userId: ctx.userId, subscription: body.subscription, userAgent: request.headers.get("user-agent") });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Este aparelho deixa de receber notificações.
export async function DELETE(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    if (typeof body?.endpoint !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Aparelho não informado." }, { status: 400 });
    }
    await removeSubscription({ userId: ctx.userId, endpoint: body.endpoint });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
