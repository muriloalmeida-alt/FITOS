import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { OwnAccountError, updateOwnName } from "@/modules/identity/ownAccount";

/// FIT-155: edita o nome da própria conta (sempre o usuário da sessão).
export async function PATCH(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    await updateOwnName({ userId: ctx.userId, name: body && typeof body.name === "string" ? body.name : "" });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OwnAccountError) return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    throw error;
  }
}
