import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { OwnAccountError, changeOwnEmail } from "@/modules/identity/ownAccount";

/// FIT-155: troca o e-mail de acesso da própria conta, com a senha atual.
export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    await changeOwnEmail({
      userId: ctx.userId,
      email: body && typeof body.email === "string" ? body.email : "",
      password: body && typeof body.password === "string" ? body.password : "",
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OwnAccountError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "EMAIL_EM_USO" ? 409 : error.kind === "SENHA_INCORRETA" ? 403 : 400 });
    }
    throw error;
  }
}
