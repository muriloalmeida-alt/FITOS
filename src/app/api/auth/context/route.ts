import { getAuthContext } from "@/modules/tenancy/authContext";

/// Rota de prova mínima da FIT-011: expõe o contexto de autorização
/// resolvido no servidor (nunca aceita nada do cliente). Confirma "sessão
/// acessível", "não autenticado -> 401" e "contexto do tenant correto por
/// papel" sem simular nenhuma funcionalidade de negócio.
export async function GET() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    role: ctx.role,
    tenantId: ctx.tenantId,
    studentId: ctx.studentId,
  });
}
