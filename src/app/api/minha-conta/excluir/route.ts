import { cookies } from "next/headers";
import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { DeleteOwnAccountError, deleteOwnAccount } from "@/modules/account/deleteAccount";

/// Exclui a própria conta (EPIC-37): `{ password }` ou, sem senha,
/// `{ confirmation: "EXCLUIR" }`. Sem volta. Os cookies de sessão saem
/// junto, para o navegador não ficar com uma sessão que não existe mais.
export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    const body = await request.json().catch(() => null);
    await deleteOwnAccount({
      userId: ctx.userId,
      password: typeof body?.password === "string" ? body.password : undefined,
      confirmation: typeof body?.confirmation === "string" ? body.confirmation : undefined,
    });
    const jar = await cookies();
    for (const cookie of jar.getAll()) {
      if (cookie.name.includes("better-auth")) {
        jar.set(cookie.name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: cookie.name.startsWith("__Secure-") });
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof DeleteOwnAccountError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "PROIBIDO" ? 403 : 400 });
    }
    throw error;
  }
}
