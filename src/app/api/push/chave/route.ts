import { pushConfig } from "@/modules/notifications/push";

/// Chave pública VAPID para o navegador assinar o push (EPIC-31). Lida em
/// tempo de execução: trocar a chave no Railway não exige novo build.
export async function GET() {
  return Response.json({ publicKey: pushConfig()?.publicKey ?? null });
}
