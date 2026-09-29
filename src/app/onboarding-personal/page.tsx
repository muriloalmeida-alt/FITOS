import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { AuthHero, PublicMobileFooter, PublicMobileHeader } from "@/shared/ui";
import { PersonalOnboardingWizard } from "./PersonalOnboardingWizard";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Configurar seu espaço — ${appName}`,
};

/// Onboarding profissional do Personal (FIT-113, EPIC-14, seção 7 do
/// pacote) — mesmo padrão de guard server-side de `/onboarding` (FIT-101):
/// só `PERSONAL`, quem não está autenticado vai para `/entrar`, quem está
/// autenticado com outro papel vai para `/painel` (não é o onboarding
/// dessa pessoa).
export default async function OnboardingPersonalPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }
  if (ctx.role !== "PERSONAL") {
    redirect("/painel");
  }

  const [tenant, plans, subscription] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
    listActivePlansForAudience("PERSONAL"),
    getSubscriptionForTenant(ctx.tenantId),
  ]);

  return (
    <main className={styles.main}>
      <PublicMobileHeader />
      <AuthHero
        headline="Treinar pessoas é a sua paixão."
        subtitle="Vamos cuidar da rotina junto com você."
        image={{ src: "/media/brand/visual-2026/scene-trainer.png", objectPosition: "58% 35%" }}
      />

      <div className={styles.formColumn}>
        <div className={styles.card}>
          <PersonalOnboardingWizard
            initialBusinessName={tenant.name}
            plans={plans.map((plan) => ({
              id: plan.id,
              name: plan.name,
              description: plan.description,
              priceCents: plan.priceCents,
              billingCycle: plan.billingCycle,
              studentLimit: plan.studentLimit,
              trialDays: plan.trialDays,
            }))}
            initialPlanId={subscription?.planId ?? null}
          />
        </div>
      </div>
      <PublicMobileFooter />
    </main>
  );
}
