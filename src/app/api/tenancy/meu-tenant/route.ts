import { prisma } from "@/shared/db/prisma";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { OnboardingError, updatePersonalAccount } from "@/modules/personal-onboarding/onboarding";

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

const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

/// Perfil do Personal (FIT-149): edita nome do espaço, perfil profissional
/// (celular, CREF, faixa de alunos) e o nome da pessoa — sempre do tenant e
/// do usuário da sessão, nunca de um id vindo do cliente.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }
    await updatePersonalAccount({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      businessName: optionalString(body.businessName),
      phone: optionalString(body.phone),
      cref: optionalString(body.cref),
      studentRangeEstimate: optionalString(body.studentRangeEstimate) as PersonalStudentRangeEstimate | undefined,
      name: optionalString(body.name),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
