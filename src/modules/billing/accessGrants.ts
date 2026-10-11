import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type AccessGrantState, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import { logEvent } from "@/shared/lib/serverLog";
import { subscriptionAccess, type AccessState } from "./access";
import {
  GRANT_REASON_TEXT_MAX,
  freeAccessUntil,
  grantEligibility,
  grantWindow,
  lastIncludedDay,
  validateGrantInput,
  type GrantBlock,
  type GrantReason,
} from "./grantRules";

/// Renovação de gratuidade (feature 4): o administrador concede dias de
/// acesso gratuito a um personal ou FitOS Livre. Fluxo em duas etapas:
/// prévia (datas e impacto, com `revision`) e confirmação (recalcula e
/// recusa prévia desatualizada). `operationKey` torna o envio idempotente.
/// Só chamado depois de `requireAdmin()`.

/// Benefícios que contam para acesso e cobrança.
export const ACTIVE_GRANTS = { where: { state: "ACTIVE" as AccessGrantState }, select: { startsAt: true, endsAt: true } };

const AUDIENCE = { PERSONAL: "Personal", INDIVIDUAL: "FitOS Livre" } as const;

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
              plan: { select: { name: true, priceCents: true } },
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

function computePreview(target: Awaited<ReturnType<typeof loadTarget>>, days: number, now: Date): GrantPreview & { tenantId?: string; subscriptionId?: string } {
  const subscription = target.ownedTenant?.saasSubscription ?? null;
  const eligibility = grantEligibility(target.role, subscription, Boolean(target.ownedTenant));
  if (!eligibility.ok) return { eligible: false, kind: eligibility.kind, message: eligibility.message };
  const sub = subscription!;
  const active = sub.accessGrants.filter((grant) => grant.state === "ACTIVE");
  const window = grantWindow(sub.trialEndsAt, active, days, now);
  // Muda quando algo que afeta as datas muda entre a prévia e a confirmação.
  const revision = createHash("sha256")
    .update(JSON.stringify([sub.id, sub.status, sub.planId, sub.plan.priceCents, sub.trialEndsAt, sub.externalSubscriptionId, sub.creditCardLast4, sub.accessGrants.map((grant) => [grant.id, grant.state]), days]))
    .digest("hex")
    .slice(0, 16);
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
    billing:
      sub.status === "CANCELADA"
        ? "Assinatura cancelada: libera o acesso no período, sem reativar cobrança."
        : "Sem cobrança automática ligada: nenhuma cobrança externa a ajustar. A próxima cobrança passa para depois do benefício.",
    revision,
  };
}

function strip(preview: ReturnType<typeof computePreview>): GrantPreview {
  const { tenantId: _tenantId, subscriptionId: _subscriptionId, ...rest } = preview;
  return rest;
}

export async function previewAccessGrant(input: { userId: string; days: unknown }, client: PrismaClient = prisma, now = new Date()): Promise<GrantPreview> {
  const error = validateGrantInput({ days: input.days, reasonCode: "SUPORTE", reasonText: "" });
  if (error) throw new AdminError("VALIDACAO", error);
  return strip(computePreview(await loadTarget(input.userId, client), input.days as number, now));
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

export async function grantAccess(input: GrantAccessInput, client: PrismaClient = prisma, now = new Date()): Promise<{ grant: GrantSummary; replayed: boolean }> {
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

  try {
    const grant = await client.$transaction(async (tx) => {
      const target = await loadTarget(input.userId, tx);
      const tenantId = target.ownedTenant?.id;
      // Uma concessão por espaço de cada vez: a segunda espera e recalcula.
      if (tenantId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`access-grant:${tenantId}`}))`;
      // O mesmo envio pode ter gravado enquanto esperávamos a vez.
      if (await tx.administrativeAccessGrant.findUnique({ where: { operationKey }, select: { id: true } })) return null;
      const preview = computePreview(await loadTarget(input.userId, tx), input.days as number, now);
      if (!preview.eligible) throw new AdminError("VALIDACAO", preview.message);
      if (preview.revision !== input.revision) throw new AdminError("CONFLITO", "A assinatura mudou desde a prévia. Revise de novo antes de confirmar.");
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
        },
      });
      await tx.adminBenefitAudit.create({
        data: {
          actorId: input.adminUserId,
          tenantId: created.tenantId,
          grantId: created.id,
          operation: "CONCEDER",
          before: { freeUntil: preview.freeUntil, access: preview.access },
          after: { startsAt: created.startsAt, endsAt: created.endsAt, days: created.days },
          reason: [input.reasonCode, reasonText].filter(Boolean).join(": "),
        },
      });
      return created;
    });
    if (!grant) return (await replay())!;
    logEvent("info", "gratuidade concedida", { grantId: grant.id, tenantId: grant.tenantId, days: grant.days });
    return { grant: grantSummary(grant), replayed: false };
  } catch (error) {
    // Mesmo envio em paralelo: o outro gravou primeiro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await replay();
      if (existing) return existing;
    }
    throw error;
  }
}

export async function revokeAccessGrant(input: { adminUserId: string; grantId: string; reason: unknown }, client: PrismaClient = prisma, now = new Date()): Promise<GrantSummary> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw new AdminError("VALIDACAO", "Descreva o motivo da revogação.");
  if (reason.length > GRANT_REASON_TEXT_MAX) throw new AdminError("VALIDACAO", `O motivo pode ter até ${GRANT_REASON_TEXT_MAX} caracteres.`);
  const grant = await client.$transaction(async (tx) => {
    const current = await tx.administrativeAccessGrant.findUnique({ where: { id: input.grantId } });
    if (!current) throw new AdminError("NAO_ENCONTRADO", "Benefício não encontrado.");
    if (current.state === "REVOKED") throw new AdminError("CONFLITO", "Este benefício já foi revogado.");
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
  }));
}
