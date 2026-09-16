import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getServerSession } from "@/modules/identity/session";
import { ensureTenantForPersonal } from "./ensureTenantForPersonal";

/// Contexto de autorização confiável (FIT-011): a única fonte que os
/// módulos de negócio devem consultar para saber "quem está autenticado,
/// com qual papel, em qual tenant". Nunca deriva nada do cliente — sempre
/// da sessão do servidor (`getServerSession`) e, a partir dela, das
/// tabelas físicas `Tenant`/`Student` (nunca de um `tenantId` recebido em
/// payload, cookie, header ou parâmetro de rota).
///
/// Um `AuthContext` com `authenticated: true` e `tenantId: null` representa
/// um caso real, não um bug: um usuário ALUNO cuja sessão é válida, mas que
/// ainda não tem (ou não tem mais) um `Student` vinculado — "sessão válida
/// para usuário inativo ou vínculo inexistente". Esse caso deve ser tratado
/// como sem permissão (403), nunca como erro interno.
export type AuthContext =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: "PERSONAL"; tenantId: string; studentId: null }
  | { authenticated: true; userId: string; role: "ALUNO"; tenantId: string; studentId: string }
  | { authenticated: true; userId: string; role: "ALUNO"; tenantId: null; studentId: null };

type ServerSession = Awaited<ReturnType<typeof getServerSession>>;

/// `sessionOverride` existe exclusivamente para testes: permite simular um
/// resultado de `getServerSession()` sem depender de `next/headers()`, que
/// só funciona dentro do runtime de requisição do Next.js (não em testes
/// unitários chamando a função diretamente). `client` (também só para
/// testes, contra o banco de testes) segue o mesmo padrão de
/// `ensureTenantForPersonal`. Em código de produção, toda chamada é
/// `getAuthContext()` sem argumentos.
export async function getAuthContext(sessionOverride?: ServerSession, client: PrismaClient = prisma): Promise<AuthContext> {
  const session = sessionOverride !== undefined ? sessionOverride : await getServerSession();
  if (!session) {
    return { authenticated: false };
  }

  const { user } = session;

  if (user.role === "PERSONAL") {
    // Autocura (FIT-010): garante que o personal autenticado tenha um
    // tenant mesmo que o provisionamento automático no cadastro tenha
    // falhado — nunca retorna tenantId nulo para um PERSONAL autenticado.
    const tenant = await ensureTenantForPersonal(user, client);
    return { authenticated: true, userId: user.id, role: "PERSONAL", tenantId: tenant.id, studentId: null };
  }

  const student = await client.student.findUnique({ where: { userId: user.id } });
  if (!student) {
    return { authenticated: true, userId: user.id, role: "ALUNO", tenantId: null, studentId: null };
  }

  return {
    authenticated: true,
    userId: user.id,
    role: "ALUNO",
    tenantId: student.tenantId,
    studentId: student.id,
  };
}

/// Erro de autorização tipado. `kind` distingue os dois casos exigidos:
/// - `UNAUTHENTICATED`: não há sessão válida — mapeado para 401 (API) ou
///   redirecionamento para `/entrar` (página).
/// - `FORBIDDEN`: há sessão válida, mas sem permissão para o recurso —
///   mapeado para 403 em ambos os casos. Nunca 404 automático (isso
///   esconderia a existência do recurso de forma inconsistente com o
///   restante da aplicação; se algum recurso específico precisar de 404
///   para reduzir enumeração, isso deve ser uma decisão explícita e
///   documentada naquele recurso, não um comportamento genérico desta
///   camada).
export class AuthError extends Error {
  constructor(
    public readonly kind: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

type AuthenticatedContext = Exclude<AuthContext, { authenticated: false }>;

export async function requireSession(
  sessionOverride?: ServerSession,
  client: PrismaClient = prisma
): Promise<AuthenticatedContext> {
  const ctx = await getAuthContext(sessionOverride, client);
  if (!ctx.authenticated) {
    throw new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida.");
  }
  return ctx;
}

export async function requirePersonal(
  sessionOverride?: ServerSession,
  client: PrismaClient = prisma
): Promise<{ userId: string; role: "PERSONAL"; tenantId: string }> {
  const ctx = await requireSession(sessionOverride, client);
  if (ctx.role !== "PERSONAL") {
    throw new AuthError("FORBIDDEN", "Acesso restrito a personal.");
  }
  return { userId: ctx.userId, role: ctx.role, tenantId: ctx.tenantId };
}

export async function requireStudent(
  sessionOverride?: ServerSession,
  client: PrismaClient = prisma
): Promise<{ userId: string; role: "ALUNO"; tenantId: string; studentId: string }> {
  const ctx = await requireSession(sessionOverride, client);
  if (ctx.role !== "ALUNO" || !ctx.tenantId || !ctx.studentId) {
    throw new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo.");
  }
  return { userId: ctx.userId, role: ctx.role, tenantId: ctx.tenantId, studentId: ctx.studentId };
}

/// Confirma que `tenantId` (sempre derivado do contexto de autorização,
/// nunca do cliente) corresponde ao `expectedTenantId` de um registro que
/// está sendo acessado. Use antes de ler/escrever qualquer entidade de
/// domínio: `assertTenantAccess(ctx.tenantId, registro.tenantId)`.
export function assertTenantAccess(tenantId: string, expectedTenantId: string): void {
  if (tenantId !== expectedTenantId) {
    throw new AuthError("FORBIDDEN", "O registro não pertence ao tenant do usuário autenticado.");
  }
}

/// Mapeamento único de `AuthError` para resposta HTTP, usado por toda rota
/// de API que dependa desta camada — garante que 401/403 sejam sempre
/// coerentes e nunca exponham mensagem interna/stack trace. Retorna `null`
/// quando o erro não é um `AuthError` (o chamador deve relançar).
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    const status = error.kind === "UNAUTHENTICATED" ? 401 : 403;
    return Response.json({ error: error.kind }, { status });
  }
  return null;
}
