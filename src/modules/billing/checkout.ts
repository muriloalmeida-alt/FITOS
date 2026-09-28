import "server-only";
import type { PrismaClient, TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AsaasApiError, tokenizeAsaasCreditCard, updateAsaasSubscription, type AsaasClientConfig } from "./asaasClient";
import { ASAAS_PROVIDER } from "./subscriptions";

const CHECKOUT_LOG_PREFIX = "[FIT-128][checkout-cartao]";

/// Checkout embutido no FitOS (FIT-128) — decisão de Murilo: "toda a
/// transação deve ocorrer no FitOS e o Asaas deve ser o gateway; o
/// cliente deve completar 100% do processo de checkout" no FitOS, nunca
/// redirecionado para uma página hospedada pelo Asaas. Diferente de
/// `tryEnsureAsaasSubscription` (`subscriptions.ts`), esta função **nunca
/// é de melhor esforço**: o cliente está completando uma ação de checkout
/// agora mesmo, então qualquer falha precisa chegar até ele como um erro
/// real e acionável (cartão recusado, dado inválido), nunca um fallback
/// silencioso.
export class CheckoutError extends Error {
  constructor(
    public readonly kind: "SEM_ASSINATURA" | "SEM_LIGACAO_ASAAS" | "CARTAO_RECUSADO",
    message: string
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface AttachCreditCardInput {
  tenantId: string;
  tenantType: TenantType;
  cardHolderName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCcv: string;
  /// Dados de cobrança exigidos pelo Asaas em `creditCardHolderInfo`
  /// (`postalCode`/`addressNumber`/`phone`) — nunca coletados antes em
  /// nenhum onboarding do FitOS, então são pedidos aqui mesmo, só no
  /// momento do checkout, nunca persistidos além desta chamada.
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface AttachCreditCardResult {
  creditCardLast4: string;
  creditCardBrand: string;
}

export interface AttachCreditCardDeps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/// Tokeniza o cartão no Asaas e vincula o token à assinatura já existente
/// (criada em modo de melhor esforço por `subscribeTenantToPlan`) — a
/// partir daí, o Asaas cobra automaticamente esse cartão a cada
/// vencimento, sem nenhuma ação adicional do cliente.
///
/// Exige que a ligação de melhor esforço ao Asaas já tenha funcionado
/// para este tenant (`provider === ASAAS_PROVIDER`, com
/// `externalCustomerId`/`externalSubscriptionId` reais) — sem isso, não
/// existe nenhum cliente real no Asaas para tokenizar o cartão contra.
/// Nome/e-mail/CPF-CNPJ do titular vêm dos dados já coletados
/// (`Tenant.name`, `User.email`, `PersonalProfile`/`IndividualProfile.cpfCnpj`)
/// — o checkout nunca pede de novo o que o onboarding já perguntou.
export async function attachCreditCardToSubscription(
  input: AttachCreditCardInput,
  client: PrismaClient = prisma,
  deps: AttachCreditCardDeps = {}
): Promise<AttachCreditCardResult> {
  const subscription = await client.saasSubscription.findUnique({ where: { tenantId: input.tenantId } });
  if (!subscription) {
    throw new CheckoutError("SEM_ASSINATURA", "Escolha um plano antes de cadastrar um cartão.");
  }
  if (subscription.provider !== ASAAS_PROVIDER || !subscription.externalCustomerId || !subscription.externalSubscriptionId) {
    throw new CheckoutError(
      "SEM_LIGACAO_ASAAS",
      "Não foi possível preparar a cobrança real para esta assinatura ainda. Tente novamente em alguns minutos ou entre em contato com o suporte."
    );
  }

  const apiKey = deps.apiKey ?? process.env.API_ASAAS;
  if (!apiKey) {
    throw new CheckoutError(
      "SEM_LIGACAO_ASAAS",
      "Não foi possível preparar a cobrança real para esta assinatura ainda. Tente novamente em alguns minutos ou entre em contato com o suporte."
    );
  }
  const config: AsaasClientConfig = { apiKey, fetchImpl: deps.fetchImpl };

  const [tenant, profile] = await Promise.all([
    client.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, include: { owner: true } }),
    input.tenantType === "PERSONAL"
      ? client.personalProfile.findUnique({ where: { tenantId: input.tenantId } })
      : client.individualProfile.findUnique({ where: { tenantId: input.tenantId } }),
  ]);
  if (!profile?.cpfCnpj) {
    throw new CheckoutError("SEM_LIGACAO_ASAAS", "Complete seu CPF/CNPJ antes de cadastrar um cartão.");
  }

  try {
    const tokenized = await tokenizeAsaasCreditCard(config, {
      customer: subscription.externalCustomerId,
      creditCard: {
        holderName: input.cardHolderName,
        number: input.cardNumber,
        expiryMonth: input.cardExpiryMonth,
        expiryYear: input.cardExpiryYear,
        ccv: input.cardCcv,
      },
      creditCardHolderInfo: {
        name: tenant.name,
        email: tenant.owner.email,
        cpfCnpj: profile.cpfCnpj,
        postalCode: input.postalCode,
        addressNumber: input.addressNumber,
        phone: input.phone,
      },
    });

    await updateAsaasSubscription(config, subscription.externalSubscriptionId, {
      billingType: "CREDIT_CARD",
      creditCardToken: tokenized.creditCardToken,
    });

    await client.saasSubscription.update({
      where: { tenantId: input.tenantId },
      data: { creditCardLast4: tokenized.creditCardNumber, creditCardBrand: tokenized.creditCardBrand },
    });

    console.log(`${CHECKOUT_LOG_PREFIX} sucesso: cartão tokenizado e vinculado à assinatura real no Asaas Sandbox.`);
    return { creditCardLast4: tokenized.creditCardNumber, creditCardBrand: tokenized.creditCardBrand };
  } catch (error) {
    if (error instanceof AsaasApiError) {
      console.error(
        `${CHECKOUT_LOG_PREFIX} falha: kind=${error.kind} status=${error.status ?? "-"} codigo=${error.codigo ?? "-"} mensagem=${error.message}`
      );
      throw new CheckoutError(
        "CARTAO_RECUSADO",
        error.kind === "resposta_de_erro"
          ? error.message
          : "Não foi possível conectar ao Asaas para processar o cartão. Tente novamente."
      );
    }
    throw error;
  }
}
