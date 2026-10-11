import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { PaymentAccountError, requestChargePayment } from "@/modules/student-finance/paymentAccount";

/// Gera (ou devolve) o link de pagamento da mensalidade na conta Asaas do
/// personal (EPIC-38). Primeira vez do aluno: `{ cpf }`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const result = await requestChargePayment({ tenantId: ctx.tenantId, chargeId: id, studentCpf: typeof body?.cpf === "string" ? body.cpf : null });
    return Response.json(result);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof PaymentAccountError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : error.kind === "ASAAS" ? 502 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
