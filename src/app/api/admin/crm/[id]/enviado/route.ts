import { requireAdmin } from "@/modules/tenancy/authContext";
import { markInvited } from "@/modules/crm/prospects";
import { adminErrorResponse } from "../../../_errors";
import { crmOff } from "../../_guard";

/// O admin abriu o WhatsApp com o convite: conta o envio.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = crmOff();
  if (off) return off;
  try {
    await requireAdmin();
    await markInvited((await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
