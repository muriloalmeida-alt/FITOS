import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type AccessGrantState, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { subscriptionAccess, type AccessState } from "./access";
import { getAsaasSubscription, listAsaasSubscriptionPayments, setAsaasSubscriptionNextDueDate, type AsaasClientConfig } from "./asaasClient";
import {
  GRANT_REASON_TEXT_MAX,
  externalBillingPlan,
  freeAccessUntil,
  grantEligibility,
  grantWindow,
  lastIncludedDay,
  paidThroughFromPayments,
  validateGrantInput,
  type ExternalBillingPlan,
  type ExternalPayment,
  type GrantBlock,
  type GrantReason,
} from "./grantRules";

/// Renovação de gratuidade (feature 4): o administrador concede dias de
/// acesso gratuito a um personal ou FitOS Livre. Fluxo em duas etapas:
/// prévia (datas e impacto, com `revision`) e confirmação (recalcula e
/// recusa prévia desatualizada). `operationKey` torna o envio idempotente.
/// Só chamado depois de `requireAdmin()`.
///
/// Conta com assinatura no Asaas (com `GRATUIDADE_ASAAS=on`): a prévia lê
/// a assinatura e as cobranças; a janela começa depois do período já pago;
/// cobrança em aberto dentro da janela bloqueia. Na confirmação, a
/// concessão nasce SYNCING, a próxima cobrança é adiada fora da transação
/// e só então vira ACTIVE. Falha ou timeout: a reconciliação confere o
/// estado no Asaas antes de repetir (`reconcileSyncingGrants`).

/// Benefícios que contam para acesso e cobrança.
export const ACTIVE_GRANTS = { where: { state: "ACTIVE" as AccessGrantState }, select: { startsAt: true, endsAt: true } };

const AUDIENCE = { PERSONAL: "Personal", INDIVIDUAL: "FitOS Livre" } as const;
const MAX_SYNC_ATTEMPTS = 3;

export interface GrantDeps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /// Liga o ajuste da cobrança no Asaas. Padrão: `GRATUIDADE_ASAAS=on`.
  asaasEnabled?: boolean;
}

function asaasEnabled(deps: GrantDeps) {
  return deps.asaasEnabled ?? process.env.GRATUIDADE_ASAAS === "on";
}

function asaasConfig(deps: GrantDeps): AsaasClientConfig | null {
  const apiKey = deps.apiKey ?? process.env.API_ASAAS;
  return apiKey ? { apiKey, fetchImpl: deps.fetchImpl } : null;
}

export type GrantPreview =
  | { eligible: false; kind: GrantBlock; message: string }
  | {
      eligible: true;
      audience: string;
      planName: string;
      subscriptionStatus: string;
      access: AccessState["kind"];
      trialEndsAt: Date | null;
      /// Fim do acesso gratuito já garantido (teste ou benefício anterior).
      freeUntil: Date | null;
      days: number;
      startsAt: Date;
      endsAt: Date;
      lastDay: string;
      billing: string;
      /// Só com cobrança no Asaas: datas e cobranças vistas lá.
      external: (ExternalBillingPlan & { paidThrough: Date | null }) | null;
      revision: string;
    };

async function loadTarget(userId: string, client: PrismaClient | Prisma.TransactionClient) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      ownedTenant: {
        select: {
          id: true,
          saasSubscription: {
            include: {
              plan: { select: { name: true, priceCents: true, billingCycle: true } },
              accessGrants: { select: { id: true, state: true, startsAt: true, endsAt: true }, orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!user) throw new AdminError("NAO_ENCONTRADO", "Usuário não encontrado.");
  return user;
}

type Target = Awaited<ReturnType<typeof loadTarget>>;

/// O que o Asaas diz hoje: próxima cobrança e cobranças já geradas.
interface ExternalSnapshot {
  nextDueDate: string;
  active: boolean;
  payments: ExternalPayment[];
}

async function readExternal(subscriptionId: string, config: AsaasClientConfig): Promise<ExternalSnapshot> {
  const [subscription, payments] = await Promise.all([getAsaasSubscription(config, subscriptionId), listAsaasSubscriptionPayments(config, subscriptionId)]);
  return {
    nextDueDate: subscription.nextDueDate,
    active: subscription.status === "ACTIVE" && !subscription.deleted,
    payments: payments.map((payment) => ({ id: payment.id, status: payment.status, dueDate: payment.dueDate, value: payment.value })),
  };
}

const dayLabel = (day: string) => day.split("-").reverse().join("/");
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function computePreview(
  target: Target,
  days: number,
  now: Date,
  options: { asaasEnabled: boolean; external: ExternalSnapshot | null }
): GrantPreview & { tenantId?: string; subscriptionId?: string } {
  const subscription = target.ownedTenant?.saasSubscription ?? null;
  const eligibility = grantEligibility(target.role, subscription, Boolean(target.ownedTenant), options.asaasEnabled);
  if (!eligibility.ok) return { eligible: false, kind: eligibility.kind, message: eligibility.message };
  const sub = subscription!;
  if (sub.accessGrants.some((grant) => grant.state === "SYNCING")) {
    return { eligible: false, kind: "EM_SINCRONIZACAO", message: "Há uma gratuidade sendo aplicada no Asaas. Espere ela terminar antes de conceder outra." };
  }
  const active = sub.accessGrants.filter((grant) => grant.state === "ACTIVE");
  const external = eligibility.external && options.external?.active ? options.external : null;
  if (eligibility.external && !options.external) {
    return { eligible: false, kind: "ASAAS_INDISPONIVEL", message: "Não foi possível consultar a assinatura no Asaas agora. Tente de novo em instantes." };
  }
  const paidThrough = external ? paidThroughFromPayments(external.payments, sub.plan.billingCycle === "ANUAL" ? "YEARLY" : "MONTHLY") : null;
  const window = grantWindow(sub.trialEndsAt, active, days, now, paidThrough);
  const plan = external ? externalBillingPlan(window, external.nextDueDate, external.payments) : null;
  if (plan && plan.openInWindow.length > 0) {
    const list = plan.openInWindow.map((payment) => `${dayLabel(payment.dueDate)} (${money(payment.value)})`).join(", ");
    return {
      eligible: false,
      kind: "COBRANCA_EMITIDA",
      message: `Já existe cobrança emitida dentro da janela gratuita: ${list}. Resolva essa cobrança no Asaas (cancelar ou manter) e revise de novo. Nada foi alterado.`,
    };
  }
  // Muda quando algo que afeta as datas muda entre a prévia e a confirmação.
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        sub.id,
        sub.status,
        sub.planId,
        sub.plan.priceCents,
        sub.trialEndsAt,
        sub.externalSubscriptionId,
        sub.creditCardLast4,
        sub.accessGrants.map((grant) => [grant.id, grant.state]),
        external ? [external.nextDueDate, external.payments.map((payment) => [payment.id, payment.status, payment.dueDate])] : null,
        days,
      ])
    )
    .digest("hex")
    .slice(0, 16);

  let billing: string;
  if (sub.status === "CANCELADA") billing = "Assinatura cancelada: libera o acesso no período, sem reativar cobrança.";
  else if (eligibility.external && !external) billing = "Assinatura no Asaas inativa: só o acesso muda, nenhuma cobrança é programada.";
  else if (plan) {
    billing = plan.needsChange
      ? `Asaas: a próxima cobrança passa de ${dayLabel(plan.currentDueDate)} para ${dayLabel(plan.targetDueDate)}. Cobranças já emitidas não mudam.`
      : `Asaas: a próxima cobrança já é em ${dayLabel(plan.currentDueDate)}, depois da janela. Nada muda lá.`;
    if (plan.oldDebts.length > 0) billing += ` Em atraso, continua devido: ${plan.oldDebts.map((payment) => `${dayLabel(payment.dueDate)} (${money(payment.value)})`).join(", ")}.`;
  } else billing = "Sem cobrança automática ligada: nenhuma cobrança externa a ajustar. A próxima cobrança passa para depois do benefício.";

  return {
    eligible: true,
    tenantId: sub.tenantId,
    subscriptionId: sub.id,
    audience: AUDIENCE[target.role as keyof typeof AUDIENCE],
    planName: sub.plan.name,
    subscriptionStatus: sub.status,
    access: subscriptionAccess(sub, now, active).kind,
    trialEndsAt: sub.trialEndsAt,
    freeUntil: freeAccessUntil(sub.trialEndsAt, active, now),
    days,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    lastDay: lastIncludedDay(window.endsAt),
    billing,
    external: plan ? { ...plan, paidThrough } : null,
    revision,
  };
}

function strip(preview: ReturnType<typeof computePreview>): GrantPreview {
  const { tenantId: _tenantId, subscriptionId: _subscriptionId, ...rest } = preview;
  return rest;
}

/// Lê o Asaas quando a conta tem assinatura lá (fora de qualquer transação).
/// `null` quando não precisa; `undefined` quando falhou.
async function externalFor(target: Target, deps: GrantDeps): Promise<ExternalSnapshot | null | undefined> {
  const sub = target.ownedTenant?.saasSubscription;
  if (!asaasEnabled(deps) || !sub?.externalSubscriptionId || sub.status === "CANCELADA") return null;
  const config = asaasConfig(deps);
  if (!config) return undefined;
  try {
    return await readExternal(sub.externalSubscriptionId, config);
  } catch (error) {
    logEvent("warn", "gratuidade_asaas_leitura_falhou", { tenantId: sub.tenantId, ...describeError(error) });
    return undefined;
  }
}

export async function previewAccessGrant(input: { userId: string; days: unknown }, client: PrismaClient = prisma, now = new Date(), deps: GrantDeps = {}): Promise<GrantPreview> {
  const error = validateGrantInput({ days: input.days, reasonCode: "SUPORTE", reasonText: "" });
  if (error) throw new AdminError("VALIDACAO", error);
  const target = await loadTarget(input.userId, client);
  const external = await externalFor(target, deps);
  return strip(computePreview(target, input.days as number, now, { asaasEnabled: asaasEnabled(deps), external: external ?? null }));
}

export interface GrantAccessInput {
  adminUserId: string;
  userId: string;
  days: unknown;
  reasonCode: unknown;
  reasonText: unknown;
  operationKey: unknown;
  revision: unknown;
}

function grantSummary(grant: { id: string; days: number; startsAt: Date; endsAt: Date; state: AccessGrantState }) {
  return { id: grant.id, days: grant.days, startsAt: grant.startsAt, endsAt: grant.endsAt, state: grant.state, lastDay: lastIncludedDay(grant.endsAt) };
}

export type GrantSummary = ReturnType<typeof grantSummary>;

export async function grantAccess(input: GrantAccessInput, client: PrismaClient = prisma, now = new Date(), deps: GrantDeps = {}): Promise<{ grant: GrantSummary; replayed: boolean }> {
  const error = validateGrantInput(input);
  if (error) throw new AdminError("VALIDACAO", error);
  if (typeof input.operationKey !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(input.operationKey)) throw new AdminError("VALIDACAO", "Operação inválida.");
  if (typeof input.revision !== "string") throw new AdminError("VALIDACAO", "Faça a prévia antes de confirmar.");
  const operationKey = input.operationKey;
  const reasonText = typeof input.reasonText === "string" && input.reasonText.trim() ? input.reasonText.trim().slice(0, GRANT_REASON_TEXT_MAX) : null;

  const replay = async () => {
    const existing = await client.administrativeAccessGrant.findUnique({ where: { operationKey }, include: { tenant: { select: { ownerId: true } } } });
    if (!existing) return null;
    if (existing.tenant.ownerId !== input.userId) throw new AdminError("VALIDACAO", "Operação inválida.");
    return { grant: grantSummary(existing), replayed: true };
  };
  const previous = await replay();
  if (previous) return previous;

  // Rede antes da transação: nunca chamar o Asaas com o banco travado.
  const external = await externalFor(await loadTarget(input.userId, client), deps);

  let grant;
  try {
    grant = await client.$transaction(async (tx) => {
      const target = await loadTarget(input.userId, tx);
      const tenantId = target.ownedTenant?.id;
      // Uma concessão por espaço de cada vez: a segunda espera e recalcula.
      if (tenantId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`access-grant:${tenantId}`}))`;
      // O mesmo envio pode ter gravado enquanto esperávamos a vez.
      if (await tx.administrativeAccessGrant.findUnique({ where: { operationKey }, select: { id: true } })) return null;
      const preview = computePreview(await loadTarget(input.userId, tx), input.days as number, now, { asaasEnabled: asaasEnabled(deps), external: external ?? null });
      if (!preview.eligible) throw new AdminError(preview.kind === "COBRANCA_EMITIDA" ? "CONFLITO" : "VALIDACAO", preview.message);
      if (preview.revision !== input.revision) throw new AdminError("CONFLITO", "A assinatura mudou desde a prévia. Revise de novo antes de confirmar.");
      const sync = preview.external?.needsChange ?? false;
      const created = await tx.administrativeAccessGrant.create({
        data: {
          tenantId: preview.tenantId!,
          subscriptionId: preview.subscriptionId!,
          actorAdminId: input.adminUserId,
          days: preview.days,
          startsAt: preview.startsAt,
          endsAt: preview.endsAt,
          reasonCode: input.reasonCode as GrantReason,
          reasonText,
          operationKey,
          state: sync ? "SYNCING" : "ACTIVE",
          previousDueDate: preview.external?.currentDueDate ?? null,
          targetDueDate: preview.external?.targetDueDate ?? null,
        },
      });
      await tx.adminBenefitAudit.create({
        data: {
          actorId: input.adminUserId,
          tenantId: created.tenantId,
          grantId: created.id,
          operation: "CONCEDER",
          before: { freeUntil: preview.freeUntil, access: preview.access, nextDueDate: preview.external?.currentDueDate ?? null },
          after: { startsAt: created.startsAt, endsAt: created.endsAt, days: created.days, nextDueDate: created.targetDueDate },
          reason: [input.reasonCode, reasonText].filter(Boolean).join(": "),
        },
      });
      return created;
    });
  } catch (error) {
    // Mesmo envio em paralelo: o outro gravou primeiro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await replay();
      if (existing) return existing;
    }
    throw error;
  }
  if (!grant) return (await replay())!;
  logEvent("info", "gratuidade concedida", { grantId: grant.id, tenantId: grant.tenantId, days: grant.days, state: grant.state });
  if (grant.state === "SYNCING") {
    const state = await syncGrant(grant.id, client, deps);
    return { grant: grantSummary({ ...grant, state }), replayed: false };
  }
  return { grant: grantSummary(grant), replayed: false };
}

/// Aplica a nova data no Asaas e confirma. Antes de repetir, confere o
/// estado lá: um envio anterior pode ter chegado mesmo sem resposta.
/// Nunca remove acesso já existente; depois de 3 tentativas, FAILED.
export async function syncGrant(grantId: string, client: PrismaClient = prisma, deps: GrantDeps = {}): Promise<AccessGrantState> {
  const grant = await client.administrativeAccessGrant.findUnique({ where: { id: grantId }, include: { subscription: { select: { externalSubscriptionId: true } } } });
  if (!grant || grant.state !== "SYNCING") return grant?.state ?? "FAILED";
  const config = asaasConfig(deps);
  const externalId = grant.subscription.externalSubscriptionId;
  const target = grant.targetDueDate;
  const finish = async (state: AccessGrantState, syncError: string | null) => {
    await client.administrativeAccessGrant.updateMany({
      where: { id: grant.id, state: "SYNCING" },
      data: { state, syncError, syncAttempts: { increment: 1 }, ...(state === "ACTIVE" ? { syncedAt: new Date() } : {}) },
    });
    if (state !== "SYNCING") {
      await client.adminBenefitAudit.create({
        data: { actorId: "sistema", tenantId: grant.tenantId, grantId: grant.id, operation: state === "ACTIVE" ? "SINCRONIZADO" : "FALHOU", after: { state, targetDueDate: target, syncError }, reason: "Ajuste da cobrança no Asaas" },
      });
    }
    logEvent(state === "ACTIVE" ? "info" : "warn", "gratuidade_asaas_sincronizacao", { grantId: grant.id, state, attempt: grant.syncAttempts + 1 });
    return state;
  };
  if (!config || !externalId || !target) return finish("FAILED", "Sem ligação com o Asaas.");

  if (grant.syncAttempts > 0) {
    try {
      const current = await getAsaasSubscription(config, externalId);
      if (current.nextDueDate >= target) return finish("ACTIVE", null);
    } catch (error) {
      const failed = grant.syncAttempts + 1 >= MAX_SYNC_ATTEMPTS;
      return finish(failed ? "FAILED" : "SYNCING", describeError(error).message ?? "Falha ao consultar o Asaas.");
    }
  }
  try {
    const updated = await setAsaasSubscriptionNextDueDate(config, externalId, target);
    if (updated.nextDueDate && updated.nextDueDate < target) return finish(grant.syncAttempts + 1 >= MAX_SYNC_ATTEMPTS ? "FAILED" : "SYNCING", `Asaas devolveu ${updated.nextDueDate}.`);
    return finish("ACTIVE", null);
  } catch (error) {
    const failed = grant.syncAttempts + 1 >= MAX_SYNC_ATTEMPTS;
    return finish(failed ? "FAILED" : "SYNCING", describeError(error).message ?? "Falha ao ajustar a cobrança no Asaas.");
  }
}

/// Reconciliação: tenta de novo as concessões que ficaram SYNCING
/// (timeout, queda do servidor). Roda no agendador e ao abrir o usuário.
export async function reconcileSyncingGrants(client: PrismaClient = prisma, deps: GrantDeps = {}, where: Prisma.AdministrativeAccessGrantWhereInput = {}): Promise<number> {
  const pending = await client.administrativeAccessGrant.findMany({ where: { ...where, state: "SYNCING" }, select: { id: true }, take: 50 });
  for (const grant of pending) await syncGrant(grant.id, client, deps);
  return pending.length;
}

export async function revokeAccessGrant(input: { adminUserId: string; grantId: string; reason: unknown }, client: PrismaClient = prisma, now = new Date()): Promise<GrantSummary> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw new AdminError("VALIDACAO", "Descreva o motivo da revogação.");
  if (reason.length > GRANT_REASON_TEXT_MAX) throw new AdminError("VALIDACAO", `O motivo pode ter até ${GRANT_REASON_TEXT_MAX} caracteres.`);
  const grant = await client.$transaction(async (tx) => {
    const current = await tx.administrativeAccessGrant.findUnique({ where: { id: input.grantId } });
    if (!current) throw new AdminError("NAO_ENCONTRADO", "Benefício não encontrado.");
    if (current.state === "REVOKED") throw new AdminError("CONFLITO", "Este benefício já foi revogado.");
    if (current.state === "SYNCING") throw new AdminError("CONFLITO", "Este benefício ainda está sendo aplicado no Asaas. Espere terminar.");
    if (current.endsAt <= now) throw new AdminError("CONFLITO", "Este benefício já terminou.");
    // Só muda se ninguém mudou antes (duas revogações ao mesmo tempo).
    const { count } = await tx.administrativeAccessGrant.updateMany({
      where: { id: current.id, state: current.state },
      data: { state: "REVOKED", revokedAt: now, revokedById: input.adminUserId, revokeReason: reason },
    });
    if (count === 0) throw new AdminError("CONFLITO", "Este benefício mudou. Atualize a página.");
    await tx.adminBenefitAudit.create({
      data: { actorId: input.adminUserId, tenantId: current.tenantId, grantId: current.id, operation: "REVOGAR", before: { state: current.state }, after: { state: "REVOKED" }, reason },
    });
    return { ...current, state: "REVOKED" as const };
  });
  logEvent("info", "gratuidade revogada", { grantId: grant.id, tenantId: grant.tenantId });
  return grantSummary(grant);
}

export interface GrantHistoryRow extends GrantSummary {
  /// Situação vista hoje: agendado, em vigor, encerrado ou revogado.
  status: "AGENDADO" | "EM_VIGOR" | "ENCERRADO" | "REVOGADO" | "SINCRONIZANDO" | "FALHOU";
  reasonCode: string;
  reasonText: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  /// Cobrança no Asaas adiada para esta data (AAAA-MM-DD), quando houve.
  targetDueDate: string | null;
  syncError: string | null;
}

export async function listAccessGrants(userId: string, client: PrismaClient = prisma, now = new Date()): Promise<GrantHistoryRow[]> {
  const grants = await client.administrativeAccessGrant.findMany({ where: { tenant: { ownerId: userId } }, orderBy: { createdAt: "desc" }, take: 50 });
  return grants.map((grant) => ({
    ...grantSummary(grant),
    status:
      grant.state === "REVOKED" ? "REVOGADO"
      : grant.state === "SYNCING" ? "SINCRONIZANDO"
      : grant.state === "FAILED" ? "FALHOU"
      : grant.endsAt <= now ? "ENCERRADO"
      : grant.startsAt > now ? "AGENDADO"
      : "EM_VIGOR",
    reasonCode: grant.reasonCode,
    reasonText: grant.reasonText,
    createdAt: grant.createdAt,
    revokedAt: grant.revokedAt,
    revokeReason: grant.revokeReason,
    targetDueDate: grant.previousDueDate !== grant.targetDueDate ? grant.targetDueDate : null,
    syncError: grant.state === "FAILED" ? grant.syncError : null,
  }));
}

/// Gratuidade do administrador vista pelo próprio dono do espaço: do
/// início do primeiro benefício ainda não encerrado até o fim do último.
export async function getOwnFreeAccess(tenantId: string, client: PrismaClient = prisma, now = new Date()): Promise<{ startsAt: Date; endsAt: Date; lastDay: string } | null> {
  const grants = await client.administrativeAccessGrant.findMany({ where: { tenantId, state: "ACTIVE", endsAt: { gt: now } }, select: { startsAt: true, endsAt: true } });
  if (grants.length === 0) return null;
  const startsAt = new Date(Math.min(...grants.map((grant) => grant.startsAt.getTime())));
  const endsAt = new Date(Math.max(...grants.map((grant) => grant.endsAt.getTime())));
  return { startsAt, endsAt, lastDay: lastIncludedDay(endsAt) };
}
