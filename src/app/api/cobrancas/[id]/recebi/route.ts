import { requirePersonal } from "@/modules/tenancy/authContext";
import { receiveChargeInFull } from "@/modules/student-finance/charges";
import { dropExternalPayment } from "@/modules/student-finance/paymentAccount";
import { chargeErrorResponse } from "../../../_chargeErrors";

/// "Recebi" em um toque: o valor cheio, hoje (EPIC-29).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const charge = await receiveChargeInFull({ tenantId: ctx.tenantId, actorUserId: ctx.userId, chargeId: id, method: typeof body?.method === "string" && body.method.trim() ? body.method : undefined });
    // Recebido à mão: a cobrança pelo app (se houver) sai, para não pagar duas vezes.
    await dropExternalPayment({ tenantId: ctx.tenantId, chargeId: id });
    return Response.json(charge);
  } catch (error) {
    return chargeErrorResponse(error);
  }
}
