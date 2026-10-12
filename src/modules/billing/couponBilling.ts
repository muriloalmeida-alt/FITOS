import "server-only";
import type { CouponRedemption, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { priceWithCoupons } from "@/shared/lib/coupons";
import { AsaasApiError, getAsaasPayment, setAsaasPaymentValue, type AsaasClientConfig } from "./asaasClient";

/// Cupons de desconto (feature 5, fatia 3, ADR-021): o desconto entra
/// cobrança a cobrança. Quando o Asaas cria uma cobrança da assinatura
/// (`PAYMENT_CREATED`), o FitOS muda o valor **daquela** cobrança se ela
/// ainda está pendente; o ciclo só conta quando ela é paga. A assinatura
/// (valor recorrente) nunca muda: acabados os ciclos, a próxima cobrança
/// vem cheia sozinha. Falha ou timeout deixa PENDING; a reconciliação lê a
/// cobrança no Asaas antes de repetir. Desligado sem `CUPONS_ASAAS=on`.

export interface CouponBillingDeps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /// Padrão: `CUPONS_ASAAS=on`.
  enabled?: boolean;
}

const MAX_ATTEMPTS = 3;

function config(deps: CouponBillingDeps): AsaasClientConfig | null {
  const enabled = deps.enabled ?? process.env.CUPONS_ASAAS === "on";
  const apiKey = deps.apiKey ?? process.env.API_ASAAS;
  return enabled && apiKey ? { apiKey, fetchImpl: deps.fetchImpl } : null;
}

const cents = (value: number) => Math.round(value * 100);

/// Ciclos ainda livres: duração − usados − cobranças com desconto em curso.
async function remainingCycles(redemption: CouponRedemption, client: PrismaClient): Promise<number> {
  const inFlight = await client.couponCycleApplication.count({ where: { redemptionId: redemption.id, countedAt: null, status: { in: ["PENDING", "APPLIED"] } } });
  return redemption.durationCycles - redemption.cyclesUsed - inFlight;
}

async function endRedemption(redemptionId: string, reason: string, client: PrismaClient, now: Date) {
  await client.couponRedemption.updateMany({ where: { id: redemptionId, state: "COMMITTED" }, data: { state: "ENDED", endedAt: now, endReason: reason } });
}

export type ApplyOutcome = "DESLIGADO" | "SEM_CUPOM" | "APLICADO" | "PENDENTE" | "IGNORADO" | "FALHOU";

/// Cobrança nova: calcula o valor com os cupons em vigor e registra as
/// aplicações (idempotente por cobrança); depois tenta no Asaas.
export async function applyCouponsToPayment(input: { tenantId: string; externalPaymentId: string }, deps: CouponBillingDeps = {}, client: PrismaClient = prisma, now = new Date()): Promise<ApplyOutcome> {
  const asaas = config(deps);
  if (!asaas) return "DESLIGADO";
  const existing = await client.couponCycleApplication.count({ where: { externalPaymentId: input.externalPaymentId } });
  if (existing > 0) return syncPayment(input.externalPaymentId, asaas, client, now);

  const subscription = await client.saasSubscription.findUnique({ where: { tenantId: input.tenantId }, include: { plan: true } });
  if (!subscription || subscription.status === "CANCELADA") return "SEM_CUPOM";
  const redemptions = await client.couponRedemption.findMany({ where: { tenantId: input.tenantId, state: "COMMITTED" }, orderBy: { committedAt: "asc" }, include: { version: { select: { planIds: true, cycles: true } } } });
  const eligible: CouponRedemption[] = [];
  for (const redemption of redemptions) {
    // Troca de plano: segue se o novo plano é elegível; senão, termina.
    if (!redemption.version.planIds.includes(subscription.planId) || !redemption.version.cycles.includes(subscription.plan.billingCycle)) {
      await endRedemption(redemption.id, "PLANO_INELEGIVEL", client, now);
      continue;
    }
    if ((await remainingCycles(redemption, client)) > 0) eligible.push(redemption);
  }
  if (eligible.length === 0) return "SEM_CUPOM";

  let payment;
  try {
    payment = await getAsaasPayment(asaas, input.externalPaymentId);
  } catch (error) {
    logEvent("error", "cupons.cobranca_leitura_falhou", { paymentId: input.externalPaymentId, ...describeError(error) });
    return "FALHOU";
  }
  if (payment.status !== "PENDING" || payment.deleted) return "IGNORADO";
  const baseCents = cents(payment.value);
  const price = priceWithCoupons(baseCents, eligible.map((row) => ({ kind: row.kind, amount: row.amount, stackable: row.stackable })));
  if (price.finalCents <= 0 || price.discountCents <= 0) return "IGNORADO";
  await client.couponCycleApplication.createMany({
    data: price.discounts.map((discount) => ({
      redemptionId: eligible[discount.index]!.id,
      tenantId: input.tenantId,
      externalPaymentId: input.externalPaymentId,
      baseCents,
      discountCents: discount.cents,
      finalCents: price.finalCents,
    })),
    skipDuplicates: true,
  });
  return syncPayment(input.externalPaymentId, asaas, client, now);
}

/// Leva a cobrança ao valor com desconto, lendo o Asaas antes de escrever
/// (reconciliação sem envio duplicado). Cobrança que já não está pendente
/// fica sem desconto e não usa ciclo.
async function syncPayment(externalPaymentId: string, asaas: AsaasClientConfig, client: PrismaClient, now: Date): Promise<ApplyOutcome> {
  const pending = await client.couponCycleApplication.findMany({ where: { externalPaymentId, status: "PENDING" } });
  if (pending.length === 0) {
    const applied = await client.couponCycleApplication.count({ where: { externalPaymentId, status: "APPLIED" } });
    return applied > 0 ? "APLICADO" : "IGNORADO";
  }
  const finalCents = pending[0]!.finalCents;
  const ids = pending.map((row) => row.id);
  try {
    let payment = await getAsaasPayment(asaas, externalPaymentId);
    if (payment.deleted || payment.status !== "PENDING") {
      await client.couponCycleApplication.updateMany({ where: { id: { in: ids } }, data: { status: "SKIPPED", lastError: `Cobrança ${payment.deleted ? "removida" : `em ${payment.status}`} antes do desconto.` } });
      return "IGNORADO";
    }
    if (cents(payment.value) !== finalCents) payment = await setAsaasPaymentValue(asaas, externalPaymentId, finalCents / 100);
    if (cents(payment.value) !== finalCents) throw new Error(`Valor no Asaas (${payment.value}) diferente do esperado.`);
    await client.couponCycleApplication.updateMany({ where: { id: { in: ids } }, data: { status: "APPLIED", appliedAt: now, lastError: null } });
    return "APLICADO";
  } catch (error) {
    const message = error instanceof AsaasApiError ? `${error.kind} ${error.status ?? ""} ${error.codigo ?? ""}`.trim() : error instanceof Error ? error.message : "erro";
    const attempts = pending[0]!.attempts + 1;
    await client.couponCycleApplication.updateMany({ where: { id: { in: ids } }, data: { attempts, lastError: message.slice(0, 300), ...(attempts >= MAX_ATTEMPTS ? { status: "FAILED" } : {}) } });
    logEvent("error", "cupons.cobranca_ajuste_falhou", { paymentId: externalPaymentId, attempts, motivo: message });
    return attempts >= MAX_ATTEMPTS ? "FALHOU" : "PENDENTE";
  }
}

/// Cobrança paga: conta um ciclo de cada cupom aplicado nela, uma vez.
/// Acabados os ciclos, o resgate termina (o orçamento não usado é liberado).
export async function countCouponCycle(externalPaymentId: string, client: PrismaClient = prisma, now = new Date()): Promise<number> {
  const applications = await client.couponCycleApplication.findMany({ where: { externalPaymentId, status: "APPLIED", countedAt: null } });
  let counted = 0;
  for (const application of applications) {
    await client.$transaction(async (tx) => {
      const { count } = await tx.couponCycleApplication.updateMany({ where: { id: application.id, countedAt: null }, data: { countedAt: now } });
      if (count === 0) return;
      const redemption = await tx.couponRedemption.update({ where: { id: application.redemptionId }, data: { cyclesUsed: { increment: 1 }, appliedCents: { increment: application.discountCents } } });
      if (redemption.cyclesUsed >= redemption.durationCycles) await tx.couponRedemption.updateMany({ where: { id: redemption.id, state: "COMMITTED" }, data: { state: "ENDED", endedAt: now, endReason: "CICLOS_CONCLUIDOS" } });
      counted++;
    });
  }
  return counted;
}

/// Cobrança removida no Asaas: o desconto ainda não contado não usa ciclo.
export async function releaseCouponPayment(externalPaymentId: string, client: PrismaClient = prisma): Promise<void> {
  await client.couponCycleApplication.updateMany({ where: { externalPaymentId, countedAt: null, status: { in: ["PENDING", "APPLIED"] } }, data: { status: "SKIPPED", lastError: "Cobrança removida." } });
}

/// Agendador: aplicações presas em PENDING (timeout, rede) há mais de 1 min.
export async function reconcilePendingCouponApplications(deps: CouponBillingDeps = {}, client: PrismaClient = prisma, now = new Date()): Promise<number> {
  const asaas = config(deps);
  if (!asaas) return 0;
  const rows = await client.couponCycleApplication.findMany({ where: { status: "PENDING", updatedAt: { lt: new Date(now.getTime() - 60_000) } }, distinct: ["externalPaymentId"], select: { externalPaymentId: true }, take: 50 });
  for (const row of rows) await syncPayment(row.externalPaymentId, asaas, client, now);
  return rows.length;
}

/// Evento do webhook (depois do ledger): cobrança criada recebe desconto;
/// paga conta o ciclo; removida libera. Nunca derruba o webhook.
export async function handleCouponPaymentEvent(event: string, externalPaymentId: string, deps: CouponBillingDeps = {}, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  try {
    if (event === "PAYMENT_CREATED") {
      const ledger = await client.saasPayment.findUnique({ where: { externalPaymentId }, select: { tenantId: true } });
      if (ledger) await applyCouponsToPayment({ tenantId: ledger.tenantId, externalPaymentId }, deps, client, now);
    } else if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED" || event === "PAYMENT_RECEIVED_IN_CASH") {
      await countCouponCycle(externalPaymentId, client, now);
    } else if (event === "PAYMENT_DELETED") {
      await releaseCouponPayment(externalPaymentId, client);
    }
  } catch (error) {
    logEvent("error", "cupons.evento_falhou", { event, paymentId: externalPaymentId, ...describeError(error) });
  }
}
