import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { getSubscriptionForTenant, type SaasSubscriptionWithPlan } from "@/modules/billing/subscriptions";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { AssinaturaView, type CurrentSubscription, type SubscriptionState } from "./AssinaturaView";

export const metadata: Metadata = {
  title: `Assinatura — ${appName}`,
};

const DAY = 86_400_000;
const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

function stateOf(subscription: SaasSubscriptionWithPlan, now: Date): SubscriptionState {
  if (subscription.status === "CANCELADA") return "cancelada";
  if (subscription.status === "INADIMPLENTE") return "pendente";
  return subscription.trialEndsAt && subscription.trialEndsAt > now ? "trial" : "ativa";
}

/// Próxima cobrança: fim do teste grátis ou o próximo aniversário do ciclo
/// a partir dele (ou da contratação). Planos gratuitos e cancelados não têm.
function nextCharge(subscription: SaasSubscriptionWithPlan, state: SubscriptionState, now: Date): Date | null {
  if (state === "cancelada" || subscription.plan.priceCents <= 0) return null;
  if (state === "trial") return subscription.trialEndsAt;
  const step = subscription.plan.billingCycle === "ANUAL" ? 12 : 1;
  const next = new Date(subscription.trialEndsAt ?? subscription.createdAt);
  while (next <= now) next.setMonth(next.getMonth() + step);
  return next;
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
  const [subscription, plans, activeStudents, profile] = await Promise.all([
    getSubscriptionForTenant(ctx.tenantId),
    listActivePlansForAudience(ctx.tenantType),
    isPersonal ? prisma.student.count({ where: { tenantId: ctx.tenantId, status: "ATIVO" } }) : Promise.resolve(0),
    isPersonal ? prisma.personalProfile.findUnique({ where: { tenantId: ctx.tenantId }, select: { phone: true } }) : Promise.resolve(null),
  ]);
  const now = new Date();

  let current: CurrentSubscription | null = null;
  if (subscription) {
    const state = stateOf(subscription, now);
    const charge = nextCharge(subscription, state, now);
    const totalTrialDays = subscription.plan.trialDays ?? 30;
    current = {
      planId: subscription.planId,
      planName: subscription.plan.name,
      priceCents: subscription.plan.priceCents,
      cycle: subscription.plan.billingCycle,
      state,
      trial:
        state === "trial" && subscription.trialEndsAt
          ? {
              daysLeft: Math.max(1, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / DAY)),
              totalDays: Math.max(totalTrialDays, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / DAY)),
              endsLabel: dateLabel.format(subscription.trialEndsAt),
            }
          : null,
      nextChargeLabel: charge ? `${dateLabel.format(charge)} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subscription.plan.priceCents / 100)}` : null,
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
      />
    </AppShell>
  );
}
