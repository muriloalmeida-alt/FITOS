import "server-only";
import type { Tenant } from "@prisma/client";
import { getServerSession } from "@/modules/identity/session";
import { ensureTenantForPersonal } from "./ensureTenantForPersonal";

/// Fluxo de reparo controlado: usado por páginas/rotas autenticadas para
/// obter (ou provisionar, se ainda não existir) o tenant do personal
/// logado. Deriva o usuário exclusivamente da sessão do servidor — nunca de
/// um parâmetro vindo do cliente. Retorna `null` sem tocar o banco quando
/// não há sessão válida ou quando o usuário autenticado não é PERSONAL
/// (aluno nunca provisiona tenant por esta via).
export async function provisionTenantForCurrentSession(): Promise<Tenant | null> {
  const session = await getServerSession();
  if (!session || session.user.role !== "PERSONAL") {
    return null;
  }
  return ensureTenantForPersonal(session.user);
}
