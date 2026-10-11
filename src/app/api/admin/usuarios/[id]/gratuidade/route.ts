import { requireAdmin } from "@/modules/tenancy/authContext";
import { grantAccess, listAccessGrants } from "@/modules/billing/accessGrants";
import { adminErrorResponse } from "../../../_errors";

/// Histórico de gratuidade do usuário (feature 4).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    return Response.json({ grants: await listAccessGrants(id) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/// Confirma a concessão da prévia (`revision`); `operationKey` repetida
/// devolve a mesma concessão sem somar dias.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const result = await grantAccess({
      adminUserId: ctx.userId,
      userId: id,
      days: body?.days,
      reasonCode: body?.reasonCode,
      reasonText: body?.reasonText,
      operationKey: body?.operationKey,
      revision: body?.revision,
    });
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
