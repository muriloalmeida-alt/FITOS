import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type CouponRedemption, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { audienceMatches, couponDiscountCents, couponSummary, lifecycleSegments, normalizeCouponCode, priceWithCoupons, stackingConflict, withinWindow, type CouponSegment } from "@/shared/lib/coupons";
import { accountFacts } from "./coupons";

/// Cupons de desconto (feature 5, fatia 2, ADR-021): a conta (personal ou
/// Livre, sempre para a própria assinatura) consulta e resgata um código.
/// A consulta não consome nada; o resgate refaz tudo numa transação com
/// trava por conta e pela versão do cupom (última vaga, orçamento,
/// acumulação) e congela as condições. Nenhuma cobrança muda aqui: o
/// desconto entra cobrança a cobrança (fatia 3).

type Client = PrismaClient | Prisma.TransactionClient;

export type CouponErrorKind = "INVALID_CODE" | "EXPIRED" | "INELIGIBLE" | "CAP_REACHED" | "CONFLICT" | "ALREADY_USED" | "QUOTE_STALE";

export class CouponRedemptionError extends Error {
  constructor(
    public readonly kind: CouponErrorKind,
    message: string
  ) {
    super(message);
    this.name = "CouponRedemptionError";
  }
}

export interface CouponQuote {
  couponId: string;
  versionId: string;
  code: string;
  summary: string;
  segment: string;
  planId: string;
  planName: string;
  durationCycles: number;
  /// Preço do plano hoje e com este cupom (e o outro acumulável, se houver).
  baseCents: number;
  discountCents: number;
  finalCents: number;
  /// Desconto deste cupom em cada cobrança, no preço de hoje.
  couponDiscountCents: number;
  combinedWith: string[];
  revision: string;
}

const ACTIVE_REDEMPTION = { state: "COMMITTED" as const };

function fail(kind: CouponErrorKind, message: string): never {
  throw new CouponRedemptionError(kind, message);
}

/// Resgates em vigor da conta: ainda com ciclos por usar.
async function activeRedemptions(tenantId: string, client: Client): Promise<CouponRedemption[]> {
  const rows = await client.couponRedemption.findMany({ where: { tenantId, ...ACTIVE_REDEMPTION }, orderBy: { committedAt: "asc" } });
  return rows.filter((row) => row.cyclesUsed < row.durationCycles);
}

/// Consulta: valida o código para esta conta e calcula o preço. Mensagens
/// nunca revelam a lista de selecionados nem regras internas.
export async function quoteCoupon(scope: { tenantId: string }, rawCode: unknown, client: Client = prisma, now = new Date()): Promise<CouponQuote> {
  const code = normalizeCouponCode(rawCode);
  if (!code) fail("INVALID_CODE", "Código inválido. Confira e tente de novo.");
  const coupon = await client.coupon.findUnique({ where: { code }, include: { currentVersion: true } });
  const version = coupon?.currentVersion;
  if (!coupon || !version || coupon.status === "DRAFT" || coupon.status === "ARCHIVED") fail("INVALID_CODE", "Código inválido. Confira e tente de novo.");
  if (coupon.status !== "ACTIVE" || !withinWindow(version, now)) fail("EXPIRED", "Este cupom não está mais disponível.");

  const subscription = await client.saasSubscription.findUnique({ where: { tenantId: scope.tenantId }, include: { plan: true } });
  if (!subscription) fail("INELIGIBLE", "Escolha um plano antes de usar um cupom.");
  const plan = subscription.plan;
  if (plan.priceCents <= 0 || !version.planIds.includes(plan.id) || !version.cycles.includes(plan.billingCycle)) fail("INELIGIBLE", "Este cupom não vale para o seu plano.");

  const facts = await accountFacts(scope.tenantId, client);
  const selected = version.segments.includes("SELECIONADOS") ? (await client.couponAudienceMember.count({ where: { versionId: version.id, tenantId: scope.tenantId } })) > 0 : false;
  if (!facts || !audienceMatches({ products: version.products, segments: version.segments as CouponSegment[] }, { ...facts, selected }, now)) fail("INELIGIBLE", "Este cupom não está disponível para a sua conta.");
  const segment = selected ? "SELECIONADOS" : (lifecycleSegments(facts, now).find((entry) => version.segments.includes(entry)) ?? "");

  const used = await client.couponRedemption.count({ where: { couponId: coupon.id, tenantId: scope.tenantId, state: { in: ["COMMITTED", "ENDED"] } } });
  if (used >= version.perAccountLimit) fail("ALREADY_USED", "Você já usou este cupom.");

  const active = await activeRedemptions(scope.tenantId, client);
  const terms = [...active.map((row) => ({ kind: row.kind, amount: row.amount, stackable: row.stackable })), { kind: version.kind, amount: version.amount, stackable: version.stackable }];
  const conflict = stackingConflict(terms);
  if (conflict) fail("CONFLICT", `${conflict} Você já tem ${active.map((row) => row.code).join(" e ")} em vigor.`);

  if (version.maxRedemptions !== null) {
    const taken = await client.couponRedemption.count({ where: { couponId: coupon.id, state: { in: ["COMMITTED", "ENDED"] } } });
    if (taken >= version.maxRedemptions) fail("CAP_REACHED", "As vagas deste cupom acabaram.");
  }

  const ownDiscount = couponDiscountCents(plan.priceCents, version);
  if (version.budgetCents !== null) {
    const committed = await client.couponRedemption.aggregate({ where: { couponId: coupon.id, state: "COMMITTED" }, _sum: { committedBudgetCents: true } });
    const applied = await client.couponRedemption.aggregate({ where: { couponId: coupon.id, state: { in: ["ENDED", "CANCELED"] } }, _sum: { appliedCents: true } });
    const spent = (committed._sum.committedBudgetCents ?? 0) + (applied._sum.appliedCents ?? 0);
    if (spent + ownDiscount * version.durationCycles > version.budgetCents) fail("CAP_REACHED", "As vagas deste cupom acabaram.");
  }

  const price = priceWithCoupons(plan.priceCents, terms);
  if (price.finalCents <= 0) fail("CONFLICT", "Junto com o seu outro cupom, a cobrança ficaria zerada. Esse caso ainda não é aceito.");

  const revision = createHash("sha256")
    .update([version.id, plan.id, plan.priceCents, ...active.map((row) => row.id)].join("|"))
    .digest("hex")
    .slice(0, 16);
  return {
    couponId: coupon.id,
    versionId: version.id,
    code,
    summary: couponSummary(version),
    segment,
    planId: plan.id,
    planName: plan.name,
    durationCycles: version.durationCycles,
    baseCents: plan.priceCents,
    discountCents: price.discountCents,
    finalCents: price.finalCents,
    couponDiscountCents: ownDiscount,
    combinedWith: active.map((row) => row.code),
    revision,
  };
}

export interface RedeemInput {
  tenantId: string;
  actorUserId: string;
  code: unknown;
  operationKey: unknown;
  revision: unknown;
}

/// Resgate atômico: trava a conta (acumulação) e a versão do cupom (última
/// vaga e orçamento), refaz a consulta e recusa se a prévia mudou. A mesma
/// `operationKey` devolve o resgate já feito.
export async function redeemCoupon(input: RedeemInput, client: PrismaClient = prisma, now = new Date()): Promise<{ redemption: CouponRedemption; replayed: boolean }> {
  if (typeof input.operationKey !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(input.operationKey)) fail("INVALID_CODE", "Operação inválida.");
  const operationKey = input.operationKey;
  const replay = async () => {
    const existing = await client.couponRedemption.findUnique({ where: { operationKey } });
    if (existing && existing.tenantId !== input.tenantId) fail("INVALID_CODE", "Operação inválida.");
    return existing;
  };
  const previous = await replay();
  if (previous) return { redemption: previous, replayed: true };

  try {
    const redemption = await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cupom:${input.tenantId}`}))`;
      const code = normalizeCouponCode(input.code);
      const coupon = code ? await tx.coupon.findUnique({ where: { code }, select: { currentVersionId: true } }) : null;
      if (coupon?.currentVersionId) await tx.$queryRaw`SELECT id FROM coupon_versions WHERE id = ${coupon.currentVersionId} FOR UPDATE`;
      const quote = await quoteCoupon({ tenantId: input.tenantId }, input.code, tx, now);
      if (quote.revision !== input.revision) fail("QUOTE_STALE", "As condições mudaram. Confira o preço de novo antes de confirmar.");
      const version = await tx.couponVersion.findUniqueOrThrow({ where: { id: quote.versionId } });
      const created = await tx.couponRedemption.create({
        data: {
          couponId: quote.couponId,
          versionId: quote.versionId,
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          operationKey,
          code: quote.code,
          kind: version.kind,
          amount: version.amount,
          stackable: version.stackable,
          durationCycles: version.durationCycles,
          segment: quote.segment,
          planId: quote.planId,
          baseCents: quote.baseCents,
          discountCents: quote.couponDiscountCents,
          committedBudgetCents: quote.couponDiscountCents * version.durationCycles,
          committedAt: now,
        },
      });
      await tx.couponAudit.create({ data: { couponId: quote.couponId, actorId: input.actorUserId, operation: "RESGATADO", after: { redemptionId: created.id, tenantId: input.tenantId, planId: quote.planId, segment: quote.segment } } });
      return created;
    });
    return { redemption, replayed: false };
  } catch (error) {
    // Mesmo envio em paralelo: o outro gravou primeiro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await replay();
      if (existing) return { redemption: existing, replayed: true };
    }
    throw error;
  }
}

export interface MyCoupon {
  id: string;
  code: string;
  summary: string;
  state: "EM_VIGOR" | "ENCERRADO";
  durationCycles: number;
  cyclesUsed: number;
  discountCents: number;
  committedAt: Date;
}

/// Cupons da conta: em vigor primeiro, depois os encerrados.
export async function listMyCoupons(tenantId: string, client: PrismaClient = prisma): Promise<MyCoupon[]> {
  const rows = await client.couponRedemption.findMany({ where: { tenantId, state: { in: ["COMMITTED", "ENDED"] } }, orderBy: [{ state: "asc" }, { committedAt: "desc" }], take: 10 });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    summary: couponSummary(row),
    state: row.state === "COMMITTED" && row.cyclesUsed < row.durationCycles ? ("EM_VIGOR" as const) : ("ENCERRADO" as const),
    durationCycles: row.durationCycles,
    cyclesUsed: row.cyclesUsed,
    discountCents: row.discountCents,
    committedAt: row.committedAt,
  }));
}
