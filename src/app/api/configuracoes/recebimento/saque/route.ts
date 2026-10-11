import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { PaymentAccountError } from "@/modules/student-finance/paymentAccount";
import { getBalanceCents, withdrawToPix } from "@/modules/student-finance/asaasSubaccount";

/// Saca o saldo da subconta para a chave Pix do personal (EPIC-38). Sem
/// valor, saca tudo.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const amountCents = typeof body?.amountCents === "number" ? body.amountCents : await getBalanceCents(ctx.tenantId);
    if (!amountCents) return Response.json({ error: "VALIDACAO", message: "Não há saldo para sacar." }, { status: 400 });
    await withdrawToPix({ tenantId: ctx.tenantId, amountCents });
    return Response.json({ amountCents }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof PaymentAccountError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "ASAAS" ? 502 : 400 });
    throw error;
  }
}
