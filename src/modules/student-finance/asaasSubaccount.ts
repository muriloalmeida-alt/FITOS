import "server-only";
import type { PrismaClient } from "@prisma/client";
import { generateRandomString, symmetricEncrypt } from "better-auth/crypto";
import { prisma } from "@/shared/db/prisma";
import { asaasRequest } from "@/modules/billing/asaasClient";
import { isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { fitosAsaasConfig } from "./fitosAsaas";
import { PaymentAccountError, WEBHOOK_EVENTS, asaasMessage, configFor, secret, type PaymentAccountStatus } from "./paymentAccount";

/// Ativar o recebimento pelo app (EPIC-38): o personal preenche um cadastro
/// curto no FitOS e o FitOS cria, na conta Asaas principal, uma subconta
/// em nome dele — com o aviso de pagamento já cadastrado. O personal nunca
/// entra no Asaas: só envia os documentos da verificação de identidade
/// pelo link que o Asaas devolve. Saldo e saque por Pix também pelo FitOS.

export type CompanyType = "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export interface SubaccountInput {
  tenantId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  /// AAAA-MM-DD; obrigatório para CPF.
  birthDate?: string | null;
  /// Obrigatório para CNPJ.
  companyType?: CompanyType | null;
  mobilePhone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string | null;
  province: string;
  /// Renda (CPF) ou faturamento (CNPJ) mensal, em reais.
  incomeValue: number;
  payoutPixKey: string;
  appUrl: string;
}

const digits = (value: string) => value.replace(/\D/g, "");

/// Tipo da chave Pix pelo formato.
export function pixKeyType(key: string): PixKeyType | null {
  const value = key.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "EMAIL";
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(value)) return "EVP";
  const only = digits(value);
  if (only.length === 14 && isValidCpfCnpj(only)) return "CNPJ";
  if (only.length === 11 && isValidCpfCnpj(only) && !value.startsWith("+") && !value.includes("(")) return "CPF";
  if (only.length === 10 || only.length === 11 || (only.length === 13 && only.startsWith("55"))) return "PHONE";
  return null;
}

function normalizePixKey(key: string, type: PixKeyType): string {
  if (type === "CPF" || type === "CNPJ") return digits(key);
  if (type === "PHONE") {
    const only = digits(key);
    return `+${only.length === 13 ? only : `55${only}`}`;
  }
  return key.trim();
}

function validate(input: SubaccountInput) {
  const cpfCnpj = digits(input.cpfCnpj);
  if (!isValidCpfCnpj(cpfCnpj)) throw new PaymentAccountError("VALIDACAO", "CPF ou CNPJ inválido.");
  const person = cpfCnpj.length === 11;
  if (person && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate ?? "")) throw new PaymentAccountError("VALIDACAO", "Informe sua data de nascimento.");
  if (!person && !input.companyType) throw new PaymentAccountError("VALIDACAO", "Informe o tipo da empresa.");
  const phone = digits(input.mobilePhone);
  if (phone.length !== 11) throw new PaymentAccountError("VALIDACAO", "Informe o celular com DDD.");
  if (digits(input.postalCode).length !== 8) throw new PaymentAccountError("VALIDACAO", "CEP inválido.");
  if (!input.address.trim() || !input.addressNumber.trim() || !input.province.trim()) throw new PaymentAccountError("VALIDACAO", "Complete o endereço.");
  if (!Number.isFinite(input.incomeValue) || input.incomeValue <= 0) throw new PaymentAccountError("VALIDACAO", "Informe a renda mensal.");
  const type = pixKeyType(input.payoutPixKey);
  if (!type) throw new PaymentAccountError("VALIDACAO", "Chave Pix inválida.");
  return { cpfCnpj, person, phone, pix: { key: normalizePixKey(input.payoutPixKey, type), type } };
}

export async function createSubaccount(input: SubaccountInput, client: PrismaClient = prisma, deps: { fetchImpl?: typeof fetch } = {}): Promise<{ status: PaymentAccountStatus; onboardingUrl: string | null }> {
  const existing = await client.paymentAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (existing) throw new PaymentAccountError("ESTADO_INVALIDO", "O recebimento pelo app já está ativado.");
  const { cpfCnpj, person, phone, pix } = validate(input);
  const main = fitosAsaasConfig(deps);
  const webhookToken = generateRandomString(32, "a-z", "0-9");
  const webhookSecret = generateRandomString(40, "a-z", "A-Z", "0-9");

  let created: { id: string; apiKey: string; walletId: string };
  try {
    created = await asaasRequest(main, "/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email,
        cpfCnpj,
        ...(person ? { birthDate: input.birthDate } : { companyType: input.companyType }),
        mobilePhone: phone,
        incomeValue: input.incomeValue,
        address: input.address.trim(),
        addressNumber: input.addressNumber.trim(),
        complement: input.complement?.trim() || undefined,
        province: input.province.trim(),
        postalCode: digits(input.postalCode),
        webhooks: [
          {
            name: "FitOS",
            url: `${input.appUrl.replace(/\/$/, "")}/api/webhooks/asaas-personal/${webhookToken}`,
            email: input.email,
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            authToken: webhookSecret,
            sendType: "SEQUENTIALLY",
            events: WEBHOOK_EVENTS,
          },
        ],
      }),
    });
  } catch (error) {
    logEvent("error", "asaas_subaccount_create_failed", { tenantId: input.tenantId, ...describeError(error) });
    throw new PaymentAccountError("ASAAS", asaasMessage(error, "O Asaas não criou a conta agora. Confira os dados e tente de novo."));
  }

  await client.paymentAccount.create({
    data: {
      tenantId: input.tenantId,
      provider: "asaas_subconta",
      environment: main.environment,
      apiKeyEncrypted: await symmetricEncrypt({ key: secret(), data: created.apiKey }),
      webhookToken,
      webhookSecret,
      webhookId: "na-criacao",
      asaasAccountId: created.id,
      walletId: created.walletId,
      status: "PENDENTE",
      payoutPixKey: pix.key,
      payoutPixKeyType: pix.type,
    },
  });
  logEvent("info", "asaas_subaccount_created", { tenantId: input.tenantId, environment: main.environment });
  return refreshAccountStatus({ tenantId: input.tenantId, force: true }, client, deps);
}

const STATUS_FROM_ASAAS: Record<string, PaymentAccountStatus> = { APPROVED: "APROVADA", REJECTED: "RECUSADA", PENDING: "PENDENTE", AWAITING_APPROVAL: "PENDENTE" };
const RECHECK_MS = 10 * 60_000;

/// Situação da verificação de identidade e o link para enviar documentos.
/// Consulta o Asaas no máximo a cada 10 min (o webhook também avisa).
export async function refreshAccountStatus(
  input: { tenantId: string; force?: boolean; now?: Date },
  client: PrismaClient = prisma,
  deps: { fetchImpl?: typeof fetch } = {}
): Promise<{ status: PaymentAccountStatus; onboardingUrl: string | null }> {
  const account = await client.paymentAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!account) return { status: "NAO_ATIVADO", onboardingUrl: null };
  const now = input.now ?? new Date();
  const fresh = account.statusCheckedAt && now.getTime() - account.statusCheckedAt.getTime() < RECHECK_MS;
  if (account.status === "APROVADA" || (!input.force && fresh)) return { status: account.status as PaymentAccountStatus, onboardingUrl: account.onboardingUrl };
  try {
    const { config } = await configFor(input.tenantId, client, deps);
    const [situation, documents] = await Promise.all([
      asaasRequest<{ general?: string }>(config, "/myAccount/status"),
      asaasRequest<{ data?: { status?: string; onboardingUrl?: string | null }[] }>(config, "/myAccount/documents").catch(() => ({ data: [] })),
    ]);
    const status = STATUS_FROM_ASAAS[situation.general ?? ""] ?? "PENDENTE";
    const pending = (documents.data ?? []).find((doc) => doc.onboardingUrl && doc.status !== "APPROVED");
    const onboardingUrl = status === "APROVADA" ? null : (pending?.onboardingUrl ?? account.onboardingUrl);
    await client.paymentAccount.update({ where: { tenantId: input.tenantId }, data: { status, onboardingUrl, statusCheckedAt: now } });
    return { status, onboardingUrl };
  } catch (error) {
    logEvent("error", "asaas_subaccount_status_failed", { tenantId: input.tenantId, ...describeError(error) });
    return { status: account.status as PaymentAccountStatus, onboardingUrl: account.onboardingUrl };
  }
}

export async function getBalanceCents(tenantId: string, client: PrismaClient = prisma, deps: { fetchImpl?: typeof fetch } = {}): Promise<number | null> {
  try {
    const { config } = await configFor(tenantId, client, deps);
    const { balance } = await asaasRequest<{ balance: number }>(config, "/finance/balance");
    return Math.round(balance * 100);
  } catch (error) {
    logEvent("error", "asaas_subaccount_balance_failed", { tenantId, ...describeError(error) });
    return null;
  }
}

/// Saca o saldo para a chave Pix do personal. Só com a conta aprovada.
export async function withdrawToPix(input: { tenantId: string; amountCents: number }, client: PrismaClient = prisma, deps: { fetchImpl?: typeof fetch } = {}): Promise<void> {
  const account = await client.paymentAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!account) throw new PaymentAccountError("NAO_CONECTADA", "Ative o recebimento pelo app em Configurações.");
  if (account.status !== "APROVADA") throw new PaymentAccountError("ESTADO_INVALIDO", "O saque libera quando o Asaas aprovar sua conta.");
  if (!account.payoutPixKey || !account.payoutPixKeyType) throw new PaymentAccountError("VALIDACAO", "Cadastre a chave Pix para os saques.");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new PaymentAccountError("VALIDACAO", "Valor de saque inválido.");
  const { config } = await configFor(input.tenantId, client, deps);
  try {
    await asaasRequest(config, "/transfers", {
      method: "POST",
      body: JSON.stringify({ value: input.amountCents / 100, operationType: "PIX", pixAddressKey: account.payoutPixKey, pixAddressKeyType: account.payoutPixKeyType, description: "Saque FitOS" }),
    });
  } catch (error) {
    throw new PaymentAccountError("ASAAS", asaasMessage(error, "O Asaas não fez o saque agora. Tente de novo."));
  }
  logEvent("info", "asaas_subaccount_withdraw", { tenantId: input.tenantId, amountCents: input.amountCents });
}

export async function updatePayoutPixKey(input: { tenantId: string; key: string }, client: PrismaClient = prisma): Promise<void> {
  const type = pixKeyType(input.key);
  if (!type) throw new PaymentAccountError("VALIDACAO", "Chave Pix inválida.");
  await client.paymentAccount.update({ where: { tenantId: input.tenantId }, data: { payoutPixKey: normalizePixKey(input.key, type), payoutPixKeyType: type } });
}
