import { requireAdmin } from "@/modules/tenancy/authContext";
import { previewAccessGrant } from "@/modules/billing/accessGrants";
import { adminErrorResponse } from "../../../../_errors";

/// Prévia da gratuidade: datas, situação atual e impacto na cobrança.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return Response.json(await previewAccessGrant({ userId: id, days: body?.days }));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
