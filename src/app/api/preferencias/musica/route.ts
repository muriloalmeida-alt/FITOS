import { getServerSession } from "@/modules/identity/session";
import { setMusicPreference } from "@/modules/preferences/music";
import { isMusicProvider } from "@/shared/lib/music";

/// Guarda o serviço de música preferido do próprio usuário. Chamado depois
/// de abrir o serviço: falhar aqui nunca atrasa a abertura nem o treino.
export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
  if (!isMusicProvider(body?.provider)) return Response.json({ error: "VALIDACAO", message: "Escolha Spotify ou Apple Music." }, { status: 400 });
  await setMusicPreference(session.user.id, body.provider);
  return new Response(null, { status: 204 });
}
