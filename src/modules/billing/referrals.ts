import "server-only";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { asaasRequest } from "./asaasClient";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Indicação de personal para personal (EPIC-47). Quem indica compartilha
/// `/i/<código>`; o indicado cria a conta e ganha 30 dias a mais de teste.
/// Quando o primeiro pagamento do indicado é confirmado, quem indicou
/// ganha um mês: a próxima cobrança anda 30 dias (ou o teste, se ainda
/// estiver nele).

export const REFERRAL_BONUS_DAYS = 30;
export const REFERRAL_COOKIE = "fitos_indicacao";

/// Código guardado pelo link `/i/<código>`, lido do cabeçalho Cookie.
export function referralCodeFromCookie(header: string | null): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([a-z0-9]{5,16})(?:;|$)`));
  return match?.[1] ?? null;
}
/// Só conta para contas novas: quem já usa o FitOS há mais tempo não
/// "vira indicado" depois.
const MAX_ACCOUNT_AGE_DAYS = 7;
const DAY = 86_400_000;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export async function getOrCreateReferralCode(tenantId: string, client: PrismaClient = prisma): Promise<string> {
  const tenant = await client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referralCode: true } });
  if (tenant.referralCode) return tenant.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = Array.from(randomBytes(7), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
    try {
      await client.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
      return code;
    } catch {
      // Colisão improvável no índice único: tenta outro.
    }
  }
  throw new Error("Não foi possível gerar o código de indicação.");
}

export const isReferralCode = (code: unknown): code is string => typeof code === "string" && /^[a-z0-9]{5,16}$/.test(code);

/// Liga o espaço recém-criado a quem indicou e estende o teste grátis.
/// Ignora (sem erro) código inválido, autoindicação e conta antiga.
export async function applyPersonalReferral(input: { referredTenantId: string; code: unknown; now?: Date }, client: PrismaClient = prisma): Promise<boolean> {
  if (!isReferralCode(input.code)) return false;
  const now = input.now ?? new Date();
  const [referrer, referred] = await Promise.all([
    client.tenant.findUnique({ where: { referralCode: input.code }, select: { id: true, type: true, ownerId: true } }),
    client.tenant.findUnique({ where: { id: input.referredTenantId }, select: { id: true, type: true, ownerId: true, createdAt: true, referralReceived: { select: { id: true } } } }),
  ]);
  if (!referrer || !referred || referrer.type !== "PERSONAL" || referred.type !== "PERSONAL") return false;
  if (referrer.id === referred.id || referrer.ownerId === referred.ownerId || referred.referralReceived) return false;
  if (now.getTime() - referred.createdAt.getTime() > MAX_ACCOUNT_AGE_DAYS * DAY) return false;
  await client.$transaction(async (tx) => {
    await tx.personalReferral.create({ data: { referrerTenantId: referrer.id, referredTenantId: referred.id } });
    const subscription = await tx.saasSubscription.findUnique({ where: { tenantId: referred.id }, select: { trialEndsAt: true } });
    if (subscription?.trialEndsAt) await tx.saasSubscription.update({ where: { tenantId: referred.id }, data: { trialEndsAt: new Date(subscription.trialEndsAt.getTime() + REFERRAL_BONUS_DAYS * DAY) } });
  });
  logEvent("info", "indicacao_aplicada", { referrerTenantId: referrer.id, referredTenantId: referred.id });
  return true;
}

const ymd = (date: Date) => date.toISOString().slice(0, 10);

/// Primeiro pagamento confirmado do indicado: um mês para quem indicou.
/// Idempotente (só o primeiro aviso de pagamento conta).
export async function rewardReferrer(
  input: { referredTenantId: string; now?: Date },
  deps: { client?: PrismaClient; fetchImpl?: typeof fetch; apiKey?: string; sender?: Sender; config?: PushConfig | null } = {}
): Promise<"recompensado" | "sem_indicacao"> {
  const client = deps.client ?? prisma;
  const now = input.now ?? new Date();
  const referral = await client.personalReferral.findUnique({ where: { referredTenantId: input.referredTenantId }, include: { referrer: { select: { id: true, ownerId: true } }, referred: { select: { name: true } } } });
  if (!referral || referral.rewardedAt) return "sem_indicacao";
  const { count } = await client.personalReferral.updateMany({ where: { id: referral.id, rewardedAt: null }, data: { rewardedAt: now } });
  if (count === 0) return "sem_indicacao";

  const subscription = await client.saasSubscription.findUnique({ where: { tenantId: referral.referrer.id }, select: { trialEndsAt: true, externalSubscriptionId: true } });
  let how = "sem assinatura";
  try {
    if (subscription?.trialEndsAt && subscription.trialEndsAt > now) {
      await client.saasSubscription.update({ where: { tenantId: referral.referrer.id }, data: { trialEndsAt: new Date(subscription.trialEndsAt.getTime() + REFERRAL_BONUS_DAYS * DAY) } });
      how = "teste estendido";
    } else if (subscription?.externalSubscriptionId) {
      const apiKey = deps.apiKey ?? process.env.API_ASAAS;
      if (!apiKey) throw new Error("API_ASAAS ausente");
      const config = { apiKey, fetchImpl: deps.fetchImpl };
      const path = `/subscriptions/${encodeURIComponent(subscription.externalSubscriptionId)}`;
      const current = await asaasRequest<{ nextDueDate: string }>(config, path);
      const next = new Date(new Date(`${current.nextDueDate}T12:00:00Z`).getTime() + REFERRAL_BONUS_DAYS * DAY);
      // Adiar a próxima cobrança (nunca antecipar) é o mês grátis.
      await asaasRequest(config, path, { method: "PUT", body: JSON.stringify({ nextDueDate: ymd(next), updatePendingPayments: true }) });
      how = "cobrança adiada";
    }
  } catch (error) {
    logEvent("error", "indicacao_recompensa_falhou", { referrerTenantId: referral.referrer.id, ...describeError(error) });
    how = "falhou";
  }
  logEvent("info", "indicacao_recompensada", { referrerTenantId: referral.referrer.id, referredTenantId: input.referredTenantId, how });
  try {
    await sendToUser(referral.referrer.ownerId, { title: "Indicação confirmada: 1 mês grátis", body: `${referral.referred.name} assinou o FitOS. Seu próximo mês é por nossa conta.`, url: "/painel/configuracoes", tag: `indicacao-${referral.id}` }, { client, sender: deps.sender, config: deps.config });
  } catch (error) {
    logEvent("error", "indicacao_push_falhou", describeError(error));
  }
  return "recompensado";
}

export async function getReferralSummary(tenantId: string, client: PrismaClient = prisma): Promise<{ code: string; invited: number; confirmed: number; referredBonus: boolean }> {
  const [code, invited, confirmed, received] = await Promise.all([
    getOrCreateReferralCode(tenantId, client),
    client.personalReferral.count({ where: { referrerTenantId: tenantId } }),
    client.personalReferral.count({ where: { referrerTenantId: tenantId, rewardedAt: { not: null } } }),
    client.personalReferral.findUnique({ where: { referredTenantId: tenantId }, select: { id: true } }),
  ]);
  return { code, invited, confirmed, referredBonus: received !== null };
}
