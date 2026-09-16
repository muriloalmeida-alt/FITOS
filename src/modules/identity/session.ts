import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

/// Acesso à sessão no servidor (Server Components, Server Actions, Route
/// Handlers). Retorna `null` quando não há sessão válida — nunca lança para
/// esse caso, para que o chamador decida o tratamento (redirecionar, 401).
///
/// Esta é uma primitiva mínima, o suficiente para a FIT-009 comprovar
/// "sessão acessível no servidor" e proteger uma rota. A camada completa de
/// autorização — contexto com userId/role/tenantId/studentId,
/// `requirePersonal`, `requireStudent`, `assertTenantAccess` — é escopo da
/// FIT-011 (`AUTORIZACAO-E-PAPEIS.md`) e substituirá o uso direto desta
/// função pelos módulos de negócio.
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
