import { requireAdmin } from "@/modules/tenancy/authContext";
import { createProspect } from "@/modules/crm/prospects";
import { adminErrorResponse } from "../_errors";
import { crmOff } from "./_guard";

/// CRM de convites: cadastra um futuro cliente do FitOS Livre, com o
/// cupom próprio dele criado e ativado na hora.
export async function POST(request: Request) {
  const off = crmOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    const prospect = await createProspect(ctx.userId, { name: body.name, phone: body.phone, email: body.email, note: body.note });
    return Response.json({ id: prospect.id }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
