import "server-only";
import type { PrismaClient } from "@prisma/client";
import { symmetricDecrypt } from "better-auth/crypto";
import { prisma } from "@/shared/db/prisma";
import { AsaasApiError, asaasRequest, type AsaasClientConfig } from "@/modules/billing/asaasClient";
import { isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { secretsMatch } from "@/shared/lib/secretCompare";
import { registerPayment } from "./charges";
import { FITOS_FEE_PERCENT, fitosWalletId } from "./fitosAsaas";

/// Cobrança do aluno pelo app (EPIC-38), na subconta Asaas que o FitOS
/// criou para o personal (`asaasSubaccount.ts`): o dinheiro cai para ele e
/// 2% vão para o FitOS por split. Gera a cobrança (Pix, boleto ou cartão, à
/// escolha do aluno) e dá a baixa sozinho quando o Asaas avisa do pagamento.

const PRODUCTION_URL = "https://api.asaas.com/v3";
const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
export const WEBHOOK_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_DELETED", "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED", "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED"];

export class PaymentAccountError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_CONECTADA" | "NAO_ENCONTRADO" | "ESTADO_INVALIDO" | "ASAAS",
    message: string
  ) {
    super(message);
    this.name = "PaymentAccountError";
  }
}

type Deps = { fetchImpl?: typeof fetch };

export function secret(): string {
  const value = process.env.PAYMENT_KEYS_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("PAYMENT_KEYS_SECRET/BETTER_AUTH_SECRET ausente.");
  return value;
}

export function baseUrl(environment: string): string {
  return environment === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
}

export async function configFor(tenantId: string, client: PrismaClient, deps: Deps): Promise<{ config: AsaasClientConfig; account: { webhookId: string | null; environment: string } }> {
  const account = await client.paymentAccount.findUnique({ where: { tenantId } });
  if (!account) throw new PaymentAccountError("NAO_CONECTADA", "Ative o recebimento pelo app em Configurações para cobrar os alunos.");
  const apiKey = await symmetricDecrypt({ key: secret(), data: account.apiKeyEncrypted });
  return { config: { apiKey, baseUrl: baseUrl(account.environment), fetchImpl: deps.fetchImpl }, account };
}

export function asaasMessage(error: unknown, fallback: string): string {
  if (error instanceof AsaasApiError && error.kind === "resposta_de_erro") {
    return error.codigo && error.message && !error.message.includes("sem descrição") ? error.message : fallback;
  }
  return fallback;
}

export type PaymentAccountStatus = "NAO_ATIVADO" | "PENDENTE" | "APROVADA" | "RECUSADA";

export interface PaymentAccountSummary {
  status: PaymentAccountStatus;
  /// Link do Asaas para enviar documentos (verificação de identidade).
  onboardingUrl: string | null;
  payoutPixKey: string | null;
}

export async function getPaymentAccountSummary(tenantId: string, client: PrismaClient = prisma): Promise<PaymentAccountSummary> {
  const account = await client.paymentAccount.findUnique({ where: { tenantId }, select: { status: true, onboardingUrl: true, payoutPixKey: true } });
  return account ? { status: account.status as PaymentAccountStatus, onboardingUrl: account.onboardingUrl, payoutPixKey: account.payoutPixKey } : { status: "NAO_ATIVADO", onboardingUrl: null, payoutPixKey: null };
}

/// Encerra o recebimento pelo app no FitOS (exclusão da conta): o aviso de
/// pagamento sai da subconta e o vínculo local some. A subconta continua
/// existindo no Asaas, com o saldo do personal.
export async function disconnectPaymentAccount(input: { tenantId: string }, client: PrismaClient = prisma, deps: Deps = {}): Promise<void> {
  const account = await client.paymentAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!account) return;
  if (account.webhookId && account.webhookId !== "na-criacao") {
    try {
      const { config } = await configFor(input.tenantId, client, deps);
      await asaasRequest(config, `/webhooks/${account.webhookId}`, { method: "DELETE" });
    } catch (error) {
      logEvent("error", "payment_account_webhook_delete_failed", { tenantId: input.tenantId, ...describeError(error) });
    }
  }
  await client.paymentAccount.delete({ where: { tenantId: input.tenantId } });
}

function dateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/// Gera (ou devolve) a cobrança da mensalidade na conta do personal.
/// Primeira vez de um aluno: o CPF dele é obrigatório (exigência do Asaas).
export async function requestChargePayment(
  input: { tenantId: string; chargeId: string; studentCpf?: string | null; now?: Date },
  client: PrismaClient = prisma,
  deps: Deps = {}
): Promise<{ paymentUrl: string; pixPayload: string | null }> {
  const charge = await client.studentCharge.findFirst({ where: { id: input.chargeId, tenantId: input.tenantId }, include: { student: true } });
  if (!charge) throw new PaymentAccountError("NAO_ENCONTRADO", "Cobrança não encontrada.");
  if (charge.status === "PAGO" || charge.status === "CANCELADO") throw new PaymentAccountError("ESTADO_INVALIDO", "Esta cobrança não está em aberto.");
  const { config } = await configFor(input.tenantId, client, deps);

  if (charge.paymentUrl && charge.externalPaymentId) {
    return { paymentUrl: charge.paymentUrl, pixPayload: await pixPayload(config, charge.externalPaymentId) };
  }

  let student = charge.student;
  const cpfInput = input.studentCpf?.replace(/\D/g, "") ?? "";
  if (cpfInput) {
    if (cpfInput.length !== 11 || !isValidCpfCnpj(cpfInput)) throw new PaymentAccountError("VALIDACAO", "CPF do aluno inválido.");
    student = await client.student.update({ where: { id: student.id }, data: { cpf: cpfInput, ...(student.cpf !== cpfInput ? { asaasCustomerId: null } : {}) } });
  }
  if (!student.cpf) throw new PaymentAccountError("VALIDACAO", "Informe o CPF do aluno: o Asaas pede na primeira cobrança.");

  try {
    let customerId = student.asaasCustomerId;
    if (!customerId) {
      const found = await asaasRequest<{ data: { id: string }[] }>(config, `/customers?cpfCnpj=${student.cpf}`);
      customerId =
        found.data[0]?.id ??
        (await asaasRequest<{ id: string }>(config, "/customers", { method: "POST", body: JSON.stringify({ name: student.displayName, cpfCnpj: student.cpf, email: student.email, externalReference: student.id, notificationDisabled: true }) })).id;
      await client.student.update({ where: { id: student.id }, data: { asaasCustomerId: customerId } });
    }
    const today = dateOnly(input.now ?? new Date());
    const due = dateOnly(charge.dueDate);
    const payment = await asaasRequest<{ id: string; invoiceUrl: string }>(config, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: charge.amountCents / 100,
        dueDate: due < today ? today : due,
        description: charge.description,
        externalReference: charge.id,
        // Taxa do FitOS (EPIC-38): 2% de cada mensalidade paga vão para a carteira do FitOS.
        split: [{ walletId: await fitosWalletId(deps), percentualValue: FITOS_FEE_PERCENT }],
      }),
    });
    await client.studentCharge.update({ where: { id: charge.id }, data: { externalPaymentId: payment.id, paymentUrl: payment.invoiceUrl } });
    return { paymentUrl: payment.invoiceUrl, pixPayload: await pixPayload(config, payment.id) };
  } catch (error) {
    if (error instanceof PaymentAccountError) throw error;
    logEvent("error", "student_charge_asaas_failed", { tenantId: input.tenantId, chargeId: charge.id, ...describeError(error) });
    throw new PaymentAccountError("ASAAS", asaasMessage(error, "O Asaas não gerou a cobrança agora. Tente de novo."));
  }
}

async function pixPayload(config: AsaasClientConfig, paymentId: string): Promise<string | null> {
  try {
    return (await asaasRequest<{ payload?: string }>(config, `/payments/${paymentId}/pixQrCode`)).payload ?? null;
  } catch {
    // Conta sem Pix habilitado: o link já oferece boleto e cartão.
    return null;
  }
}

/// Some com a cobrança no Asaas quando a mensalidade foi cancelada ou
/// recebida à mão (para o aluno não pagar duas vezes). Melhor esforço.
export async function dropExternalPayment(input: { tenantId: string; chargeId: string }, client: PrismaClient = prisma, deps: Deps = {}): Promise<void> {
  const charge = await client.studentCharge.findFirst({ where: { id: input.chargeId, tenantId: input.tenantId }, select: { externalPaymentId: true } });
  if (!charge?.externalPaymentId) return;
  try {
    const { config } = await configFor(input.tenantId, client, deps);
    await asaasRequest(config, `/payments/${charge.externalPaymentId}`, { method: "DELETE" });
  } catch (error) {
    logEvent("error", "student_charge_asaas_delete_failed", { tenantId: input.tenantId, chargeId: input.chargeId, ...describeError(error) });
  }
  await client.studentCharge.update({ where: { id: input.chargeId }, data: { externalPaymentId: null, paymentUrl: null } });
}

const METHOD: Record<string, string> = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão", DEBIT_CARD: "Cartão" };

/// Aviso de pagamento da conta do personal. Token da URL identifica a
/// conta; o cabeçalho `asaas-access-token` precisa bater com o segredo.
export async function handlePersonalWebhook(
  input: { token: string; headerToken: string | null; body: unknown },
  client: PrismaClient = prisma
): Promise<{ status: number; result: string }> {
  const account = await client.paymentAccount.findUnique({ where: { webhookToken: input.token }, include: { tenant: { select: { ownerId: true } } } });
  if (!account || !input.headerToken || !secretsMatch(input.headerToken, account.webhookSecret)) return { status: 401, result: "nao_autorizado" };
  const body = input.body as { event?: string; payment?: { id?: string; value?: number; billingType?: string; paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string } } | null;
  const event = body?.event;
  const payment = body?.payment;
  if (event?.startsWith("ACCOUNT_STATUS_")) {
    const status = event.endsWith("_APPROVED") ? "APROVADA" : event.endsWith("_REJECTED") ? "RECUSADA" : null;
    if (status && event.includes("GENERAL_APPROVAL")) await client.paymentAccount.update({ where: { tenantId: account.tenantId }, data: { status, statusCheckedAt: new Date() } });
    return { status: 200, result: status ? "status_conta" : "ignorado" };
  }
  if (!event || !payment?.id) return { status: 200, result: "ignorado" };
  const charge = await client.studentCharge.findFirst({ where: { tenantId: account.tenantId, externalPaymentId: payment.id } });
  if (!charge) return { status: 200, result: "cobranca_desconhecida" };

  if (event === "PAYMENT_DELETED") {
    if (charge.status !== "PAGO") await client.studentCharge.update({ where: { id: charge.id }, data: { externalPaymentId: null, paymentUrl: null } });
    return { status: 200, result: "removida" };
  }
  if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") return { status: 200, result: "ignorado" };
  if (charge.status === "PAGO") return { status: 200, result: "ja_paga" };
  if (charge.status === "CANCELADO") return { status: 200, result: "cancelada" };
  const paidOn = payment.paymentDate ?? payment.clientPaymentDate ?? payment.confirmedDate;
  await registerPayment(
    {
      tenantId: account.tenantId,
      actorUserId: account.tenant.ownerId,
      chargeId: charge.id,
      amountReceivedReais: typeof payment.value === "number" && payment.value > 0 ? payment.value : charge.amountCents / 100,
      paidAt: paidOn ? new Date(`${paidOn}T12:00:00-03:00`) : new Date(),
      method: METHOD[payment.billingType ?? ""] ?? "Asaas",
    },
    client
  );
  return { status: 200, result: "baixa" };
}
