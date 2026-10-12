import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { nextChargeDate } from "@/modules/billing/nextCharge";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { getSubscriptionForTenant, type SaasSubscriptionWithPlan } from "@/modules/billing/subscriptions";
import { getOwnFreeAccess } from "@/modules/billing/accessGrants";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { AssinaturaView, type CurrentSubscription, type SubscriptionState } from "./AssinaturaView";
import { featureEnabled } from "@/shared/config/features";
import { accessDateLabel, grantOutlastsTrial } from "@/shared/lib/accessDates";
import { listMyCoupons } from "@/modules/billing/couponRedemptions";
import { CouponPanel, type CouponPanelItem } from "./CouponPanel";
import { subscriptionDiscount } from "@/shared/lib/subscriptionDiscount";

export const metadata: Metadata = {
  title: `Assinatura — ${appName}`,
};

const DAY = 86_400_000;
// Com o ano quando não é este ano: uma gratuidade de 365 dias não pode
// parecer terminar em novembro deste ano.
const dateLabel = { format: (date: Date) => accessDateLabel(date, new Date()) };

function stateOf(subscription: SaasSubscriptionWithPlan, now: Date): SubscriptionState {
  if (subscription.status === "CANCELADA") return "cancelada";
  if (subscription.status === "INADIMPLENTE") return "pendente";
  return subscription.trialEndsAt && subscription.trialEndsAt > now ? "trial" : "ativa";
}

/// Próxima cobrança: ver `nextChargeDate` (compartilhada com os avisos de
/// vencimento, EPIC-34). Depois do instante atual, como antes.
function nextCharge(subscription: SaasSubscriptionWithPlan, state: SubscriptionState, now: Date, freeUntil: Date | null): Date | null {
  if (state === "cancelada") return null;
  return nextChargeDate(subscription, new Date(now.getTime() + 1), freeUntil);
}

/// Assinatura FitOS (FIT-150, P8 do protótipo) — do Personal e do FitOS
/// Livre (`requireSubscriber`), nunca do aluno. Plano, status, teste
/// grátis, próxima cobrança, uso de alunos, cartão, troca de plano com
/// planos menores bloqueados, cancelamento e "Assinar de novo" (BK-18).
export default async function AssinaturaPage() {
  let ctx;
  try {
    ctx = await requireSubscriber();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const isPersonal = ctx.role === "PERSONAL";
  const [subscription, plans, activeStudents, profile, freeAccess] = await Promise.all([
    getSubscriptionForTenant(ctx.tenantId),
    listActivePlansForAudience(ctx.tenantType),
    isPersonal ? prisma.student.count({ where: { tenantId: ctx.tenantId, status: "ATIVO" } }) : Promise.resolve(0),
    isPersonal
      ? prisma.personalProfile.findUnique({ where: { tenantId: ctx.tenantId }, select: { phone: true, cpfCnpj: true } })
      : prisma.individualProfile.findUnique({ where: { tenantId: ctx.tenantId }, select: { cpfCnpj: true } }).then((found) => (found ? { phone: null, cpfCnpj: found.cpfCnpj } : null)),
    getOwnFreeAccess(ctx.tenantId),
  ]);
  // Cupons (feature 5): só com a flag; nunca para assinatura inadimplente.
  const coupons: CouponPanelItem[] | null = featureEnabled("CUPONS") ? await listMyCoupons(ctx.tenantId) : null;
  const activeCoupons = coupons
    ? await prisma.couponRedemption.findMany({ where: { tenantId: ctx.tenantId, state: "COMMITTED" }, orderBy: { committedAt: "asc" }, select: { code: true, kind: true, amount: true, stackable: true, durationCycles: true, cyclesUsed: true } })
    : [];
  const now = new Date();

  let current: CurrentSubscription | null = null;
  if (subscription) {
    const state = stateOf(subscription, now);
    const charge = nextCharge(subscription, state, now, freeAccess?.endsAt ?? null);
    // Desconto em vigor (cupom de convite, indicação...): aparece no cartão
    // e no valor da próxima cobrança.
    const discount = state === "cancelada" ? null : subscriptionDiscount(subscription.plan.priceCents, activeCoupons, subscription.plan.billingCycle);
    const totalTrialDays = subscription.plan.trialDays ?? 30;
    const freeUntil = freeAccess?.endsAt ?? null;
    const combinedFree =
      (state === "trial" || state === "ativa") && grantOutlastsTrial(subscription.trialEndsAt, freeUntil, now)
        ? {
            // Começo do período gratuito: o início do teste (se ainda corre) ou o do benefício.
            startsAt: subscription.trialEndsAt && subscription.trialEndsAt > now ? new Date(Math.min(subscription.createdAt.getTime(), freeAccess!.startsAt.getTime())) : freeAccess!.startsAt,
            endsAt: freeUntil,
          }
        : null;
    current = {
      planId: subscription.planId,
      planName: subscription.plan.name,
      priceCents: subscription.plan.priceCents,
      cycle: subscription.plan.billingCycle,
      state,
      // Teste grátis + gratuidade concedida somados: o cliente vê um único
      // período gratuito (dias restantes e fim), não só o teste inicial.
      trial: combinedFree
        ? {
            daysLeft: Math.max(1, Math.ceil((combinedFree.endsAt.getTime() - now.getTime()) / DAY)),
            totalDays: Math.max(1, Math.ceil((combinedFree.endsAt.getTime() - combinedFree.startsAt.getTime()) / DAY)),
            endsLabel: dateLabel.format(new Date(combinedFree.endsAt.getTime() - 1)),
            granted: true,
          }
        : state === "trial" && subscription.trialEndsAt
          ? {
              daysLeft: Math.max(1, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / DAY)),
              totalDays: Math.max(totalTrialDays, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / DAY)),
              endsLabel: dateLabel.format(subscription.trialEndsAt),
              granted: false,
            }
          : null,
      nextChargeLabel: charge
        ? `${dateLabel.format(charge)} · ${discount ? `${discount.finalLabel} com desconto (em vez de ${discount.baseLabel})` : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subscription.plan.priceCents / 100)}`
        : null,
      discount: discount ? { headline: discount.headline, origin: discount.origin } : null,
      benefit: freeAccess
        ? {
            untilLabel: dateLabel.format(new Date(`${freeAccess.lastDay}T12:00:00-03:00`)),
            startsLabel: freeAccess.startsAt > now ? dateLabel.format(freeAccess.startsAt) : null,
            daysLeft: Math.max(1, Math.ceil((freeAccess.endsAt.getTime() - now.getTime()) / DAY)),
          }
        : null,
      canceledLabel: state === "cancelada" && subscription.canceledAt ? dateLabel.format(subscription.canceledAt) : null,
      card: subscription.creditCardLast4 ? { brand: subscription.creditCardBrand ?? "Cartão", last4: subscription.creditCardLast4 } : null,
      needsCard: subscription.plan.priceCents > 0 && state !== "cancelada",
    };
  }

  return (
    <AppShell eyebrow="Assinatura" title="Sua assinatura FitOS" navItems={isPersonal ? PERSONAL_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS} activeKey="assinatura" trailing={<LogoutButton />}>
      <AssinaturaView
        subscription={current}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          priceCents: plan.priceCents,
          cycle: plan.billingCycle,
          studentLimit: plan.studentLimit,
          blockedReason:
            isPersonal && plan.studentLimit !== null && activeStudents > plan.studentLimit
              ? `Você tem ${activeStudents} alunos ativos; este plano permite até ${plan.studentLimit}.`
              : null,
        }))}
        usage={isPersonal ? { active: activeStudents, limit: subscription?.plan.studentLimit ?? null } : null}
        profilePhone={profile?.phone ?? null}
        needsCpf={!profile?.cpfCnpj}
      />
      {coupons ? <CouponPanel coupons={coupons} canRedeem={subscription !== null && subscription.status !== "INADIMPLENTE" && subscription.plan.priceCents > 0} /> : null}
    </AppShell>
  );
}
