import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { EntradaShell } from "../_entrada/EntradaShell";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = {
  title: `Configurar seu espaço — ${appName}`,
};

/// Tela 2 (Onboarding) do "Treino sozinho" (FIT-101): objetivo, experiência
/// e disponibilidade — a "configuração inicial" exigida pelo pacote,
/// deliberadamente sem nenhuma alegação de prescrição personalizada. Só
/// para `INDIVIDUAL` (mesmo padrão de decisão server-side de `/painel`,
/// FIT-012): quem não está autenticado vai para `/entrar`; quem está
/// autenticado com outro papel vai para `/painel` (essa pessoa já tem seu
/// próprio destino, não este).
export default async function OnboardingPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }
  if (ctx.role !== "INDIVIDUAL") {
    redirect("/painel");
  }

  const [existingProfile, plans, subscription] = await Promise.all([
    getIndividualOnboardingProfile(ctx.tenantId),
    listActivePlansForAudience("INDIVIDUAL"),
    getSubscriptionForTenant(ctx.tenantId),
  ]);

  return (
    <EntradaShell>
      <OnboardingForm
        initialObjective={existingProfile?.objective ?? null}
        initialExperienceLevel={existingProfile?.experienceLevel ?? null}
        initialWeeklyAvailability={existingProfile?.weeklyAvailability ?? null}
        initialCpfCnpj={existingProfile?.cpfCnpj ?? null}
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
    </EntradaShell>
  );
}
