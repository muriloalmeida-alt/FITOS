import { requireAdmin } from "@/modules/tenancy/authContext";
import { discardProspect } from "@/modules/crm/prospects";
import { adminErrorResponse } from "../../../_errors";
import { crmOff } from "../../_guard";

/// Descarta o contato e encerra o cupom dele.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = crmOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    await discardProspect(ctx.userId, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
