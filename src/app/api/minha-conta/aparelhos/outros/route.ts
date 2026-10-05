import { getServerSession } from "@/modules/identity/session";
import { signOutOtherDevices } from "@/modules/identity/devices";

/// "Sair de todos os outros aparelhos" (EPIC-36): só este continua conectado.
export async function DELETE() {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const removed = await signOutOtherDevices({ userId: session.user.id, currentSessionId: session.session.id });
  return Response.json({ removed });
}
