import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { StudentAccountError, joinPersonalWithInvitation } from "@/modules/identity/studentAccount";

/// FIT-151: aluno sem vínculo entra com o código (ou link) de convite de
/// um personal, na própria conta — sempre o usuário da sessão.
export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    const code = body && typeof body === "object" && typeof body.code === "string" ? body.code : "";
    await joinPersonalWithInvitation({ userId: ctx.userId, code });
    return Response.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentAccountError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "CODIGO_INVALIDO" ? 400 : 409 });
    }
    throw error;
  }
}
