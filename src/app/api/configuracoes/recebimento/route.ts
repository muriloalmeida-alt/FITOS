import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { PaymentAccountError } from "@/modules/student-finance/paymentAccount";
import { createSubaccount, updatePayoutPixKey, type CompanyType } from "@/modules/student-finance/asaasSubaccount";

function errorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof PaymentAccountError) {
    const status = error.kind === "ASAAS" ? 502 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  throw error;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/// Ativa o recebimento pelo app (EPIC-38): cria a subconta Asaas do
/// personal com os dados do cadastro. Nome e e-mail vêm da própria conta.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true, email: true } });
    const result = await createSubaccount({
      tenantId: ctx.tenantId,
      name: text(body?.name) || owner.name,
      email: owner.email,
      cpfCnpj: text(body?.cpfCnpj),
      birthDate: text(body?.birthDate) || null,
      companyType: (["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"].includes(text(body?.companyType)) ? text(body?.companyType) : null) as CompanyType | null,
      mobilePhone: text(body?.mobilePhone),
      postalCode: text(body?.postalCode),
      address: text(body?.address),
      addressNumber: text(body?.addressNumber),
      complement: text(body?.complement) || null,
      province: text(body?.province),
      incomeValue: Number(body?.incomeValue),
      payoutPixKey: text(body?.payoutPixKey),
      appUrl: process.env.BETTER_AUTH_URL ?? new URL(request.url).origin,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/// Troca a chave Pix dos saques: `{ payoutPixKey }`.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    await updatePayoutPixKey({ tenantId: ctx.tenantId, key: text(body?.payoutPixKey) });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
