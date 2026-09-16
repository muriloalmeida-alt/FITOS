import { ActivationError, activateStudentAccount } from "@/modules/identity/activation";

/// Rota pública (sem sessão exigida — o token do convite é a própria
/// autorização). Nunca loga o token nem a senha; repassa os cabeçalhos reais
/// da sessão criada (`Set-Cookie`) para o navegador do aluno.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "VALIDACAO", message: "Informe o token e a senha." }, { status: 400 });
  }

  try {
    const result = await activateStudentAccount({ token: body.token, password: body.password });

    const response = Response.json({ ok: true });
    for (const cookie of result.headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    if (error instanceof ActivationError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
