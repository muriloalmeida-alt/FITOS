import { ActivationError } from "@/modules/identity/activation";
import { StudentError } from "@/modules/students/students";
import { InviteLinkError, joinByInviteLink } from "@/modules/students/inviteLink";

/// Rota pública: entrar no espaço do personal pelo link (EPIC-29). O
/// código do link é a autorização; repassa o cookie da sessão criada.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "VALIDACAO", message: "Informe nome, e-mail e senha." }, { status: 400 });
  }
  try {
    const result = await joinByInviteLink({ code, name: body.name, email: body.email, password: body.password, ref: typeof body.ref === "string" ? body.ref : null });
    const response = Response.json({ ok: true }, { status: 201 });
    for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    if (error instanceof InviteLinkError || error instanceof StudentError || error instanceof ActivationError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error instanceof InviteLinkError && error.kind === "LINK_INVALIDO" ? 404 : 400 });
    }
    throw error;
  }
}
