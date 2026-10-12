import { requireAdmin } from "@/modules/tenancy/authContext";
import { importProspects } from "@/modules/crm/prospects";
import { adminErrorResponse } from "../../_errors";
import { crmOff } from "../_guard";

/// CRM de convites: importação em lote (lista colada ou CSV).
export async function POST(request: Request) {
  const off = crmOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    return Response.json(await importProspects(ctx.userId, body.text));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
