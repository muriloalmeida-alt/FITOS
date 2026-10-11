import { requireAdmin } from "@/modules/tenancy/authContext";
import { revokeAccessGrant } from "@/modules/billing/accessGrants";
import { adminErrorResponse } from "../../../_errors";

/// Revoga uma gratuidade em vigor ou agendada, com motivo.
export async function POST(request: Request, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const ctx = await requireAdmin();
    const { grantId } = await params;
    const body = await request.json().catch(() => null);
    return Response.json({ grant: await revokeAccessGrant({ adminUserId: ctx.userId, grantId, reason: body?.reason }) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
