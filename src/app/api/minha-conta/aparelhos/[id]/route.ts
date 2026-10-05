import { getServerSession } from "@/modules/identity/session";
import { signOutDevice } from "@/modules/identity/devices";

/// Desconecta um aparelho da própria conta (EPIC-36). A sessão atual não
/// sai por aqui (para isso existe "Sair").
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const removed = await signOutDevice({ userId: session.user.id, sessionId: (await params).id, currentSessionId: session.session.id });
  if (!removed) return Response.json({ error: "NAO_ENCONTRADO", message: "Aparelho não encontrado." }, { status: 404 });
  return new Response(null, { status: 204 });
}
