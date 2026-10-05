import { authErrorResponse, requireSubscriber } from "@/modules/tenancy/authContext";
import { CheckoutError, attachCreditCardToSubscription } from "@/modules/billing/checkout";
import { SubscriptionError, linkSubscriptionToBilling } from "@/modules/billing/subscriptions";
import {
  isValidCreditCardCcv,
  isValidCreditCardExpiry,
  isValidCreditCardNumber,
  isValidPostalCode,
} from "@/shared/lib/creditCard";

interface CardRequestBody {
  cardHolderName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCcv: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

function parseBody(body: unknown): CardRequestBody | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const fields = ["cardHolderName", "cardNumber", "cardExpiryMonth", "cardExpiryYear", "cardCcv", "postalCode", "addressNumber", "phone"] as const;
  for (const field of fields) {
    if (typeof record[field] !== "string" || (record[field] as string).trim() === "") {
      return null;
    }
  }
  return record as unknown as CardRequestBody;
}

/// Checkout embutido de cartão (FIT-128) — decisão de Murilo: "toda a
/// transação deve ocorrer no FitOS, o Asaas deve ser o gateway; o
/// cliente deve completar 100% do processo de checkout" no FitOS, nunca
/// redirecionado para uma página do Asaas. Usado tanto pelos wizards de
/// onboarding (Personal/FitOS Livre) quanto por `/painel/assinatura`
/// (cadastrar/atualizar cartão depois). `tenantId`/`tenantType` sempre da
/// sessão, nunca do corpo — mesmo padrão de `/api/tenancy/minha-assinatura`.
///
/// Número completo do cartão e CVV chegam aqui só em trânsito — nunca
/// logados (nem em caso de erro: `authErrorResponse`/`CheckoutError`
/// nunca incluem esses campos) nem persistidos (só os 4 últimos dígitos e
/// a bandeira, devolvidos já mascarados pelo próprio Asaas, são gravados).
export async function POST(request: Request) {
  try {
    const ctx = await requireSubscriber();
    const rawBody: unknown = await request.json().catch(() => null);
    const body = parseBody(rawBody);
    if (!body) {
      return Response.json(
        { error: "VALIDACAO", message: "Informe todos os dados do cartão e do endereço de cobrança." },
        { status: 400 }
      );
    }
    if (!isValidCreditCardNumber(body.cardNumber)) {
      return Response.json({ error: "VALIDACAO", message: "Número de cartão inválido." }, { status: 400 });
    }
    if (!isValidCreditCardExpiry(body.cardExpiryMonth, body.cardExpiryYear)) {
      return Response.json({ error: "VALIDACAO", message: "Validade do cartão inválida ou vencida." }, { status: 400 });
    }
    if (!isValidCreditCardCcv(body.cardCcv)) {
      return Response.json({ error: "VALIDACAO", message: "Código de segurança (CVV) inválido." }, { status: 400 });
    }
    if (!isValidPostalCode(body.postalCode)) {
      return Response.json({ error: "VALIDACAO", message: "CEP inválido." }, { status: 400 });
    }

    // EPIC-33: o CPF/CNPJ vem junto com o primeiro cartão (o teste grátis
    // começa sem ele) e liga a assinatura à cobrança real.
    const cpfCnpj = (rawBody as { cpfCnpj?: unknown } | null)?.cpfCnpj;
    if (typeof cpfCnpj === "string" && cpfCnpj.trim() !== "") {
      await linkSubscriptionToBilling({ tenantId: ctx.tenantId, tenantType: ctx.tenantType, cpfCnpj });
    }

    const result = await attachCreditCardToSubscription({
      tenantId: ctx.tenantId,
      tenantType: ctx.tenantType,
      cardHolderName: body.cardHolderName,
      cardNumber: body.cardNumber,
      cardExpiryMonth: body.cardExpiryMonth,
      cardExpiryYear: body.cardExpiryYear,
      cardCcv: body.cardCcv,
      postalCode: body.postalCode,
      addressNumber: body.addressNumber,
      phone: body.phone,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SubscriptionError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
    }
    if (error instanceof CheckoutError) {
      const status = error.kind === "SEM_ASSINATURA" ? 404 : error.kind === "CARTAO_RECUSADO" ? 422 : 409;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
