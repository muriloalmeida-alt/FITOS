import { prisma } from "@/shared/db/prisma";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";

/// Rota de prova mínima da FIT-011: acesso exclusivo do personal ao
/// próprio tenant. Qualquer `tenantId` recebido na query string (ou em
/// qualquer outra parte do payload/requisição) é deliberadamente ignorado
/// — o tenant retornado é sempre o derivado da sessão
/// (`requirePersonal`), nunca o solicitado pelo cliente. Não é uma
/// feature de gestão de tenant — apenas a prova de que o isolamento
/// funciona.
export async function GET(_request: Request) {
  // `_request` é recebido e deliberadamente ignorado: nenhum `tenantId` de
  // query string, header ou corpo é lido em nenhum ponto deste handler.
  try {
    const ctx = await requirePersonal();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    return Response.json({ id: tenant.id, name: tenant.name });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
