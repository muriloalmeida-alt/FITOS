import { requirePersonal } from "@/modules/tenancy/authContext";
import { undoChargePayment } from "@/modules/student-finance/charges";
import { chargeErrorResponse } from "../../../_chargeErrors";

/// Desfazer um "Recebi" (EPIC-29).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    return Response.json(await undoChargePayment({ tenantId: ctx.tenantId, actorUserId: ctx.userId, chargeId: id }));
  } catch (error) {
    return chargeErrorResponse(error);
  }
}
