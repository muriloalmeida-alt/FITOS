import { requirePersonal } from "@/modules/tenancy/authContext";
import { receiveChargeInFull } from "@/modules/student-finance/charges";
import { chargeErrorResponse } from "../../../_chargeErrors";

/// "Recebi" em um toque: o valor cheio, hoje (EPIC-29).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const charge = await receiveChargeInFull({ tenantId: ctx.tenantId, actorUserId: ctx.userId, chargeId: id, method: typeof body?.method === "string" && body.method.trim() ? body.method : undefined });
    return Response.json(charge);
  } catch (error) {
    return chargeErrorResponse(error);
  }
}
