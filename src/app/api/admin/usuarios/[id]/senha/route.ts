import { requireAdmin } from "@/modules/tenancy/authContext";
import { setUserPasswordByAdmin } from "@/modules/admin/users";
import { adminErrorResponse } from "../../../_errors";

/// Define uma nova senha para o usuário e encerra as sessões dele.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    await setUserPasswordByAdmin({ adminUserId: ctx.userId, userId: id, password });
    return new Response(null, { status: 204 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
