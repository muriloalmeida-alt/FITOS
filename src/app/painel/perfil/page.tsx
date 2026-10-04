import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getPersonalOnboardingProfile } from "@/modules/personal-onboarding/onboarding";
import { studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import { getSubscriptionForTenant, type SaasSubscriptionWithPlan } from "@/modules/billing/subscriptions";
import { getFinancialSummary } from "@/modules/student-finance/charges";
import { formatCentsBRL } from "@/shared/lib/money";
import { currentReferenceMonth, referenceMonthLabel } from "@/shared/lib/referenceMonth";
import { PersonalProfileView } from "./PersonalProfileView";
import { LogoutButton } from "../LogoutButton";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "../individualProfileLabels";

export const metadata: Metadata = {
  title: `Perfil — ${appName}`,
};

function subscriptionSummary(subscription: SaasSubscriptionWithPlan | null, now: Date): string {
  if (!subscription) return "Nenhum plano contratado";
  if (subscription.status === "CANCELADA") return `${subscription.plan.name} · cancelada`;
  if (subscription.status === "INADIMPLENTE") return `${subscription.plan.name} · pagamento pendente`;
  if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
    const days = Math.max(1, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
    return `${subscription.plan.name} · teste grátis, ${days === 1 ? "último dia" : `${days} dias`}`;
  }
  return `${subscription.plan.name} · ativa`;
}

/// Página de conta/perfil (FIT-016 para o aluno; FIT-120/redesign para o
/// personal; AjustesTelas 29/09/2026 para o FitOS Livre — dados da conta,
/// do espaço, perfil de treino do onboarding e resumo real da assinatura,
/// tudo lido do tenant individual da própria sessão). O papel exibido é sempre o da própria sessão (`getAuthContext`,
/// FIT-011) — nunca um parâmetro de rota; um personal não assume a
/// identidade de um aluno alterando a URL, e vice-versa.
export default async function PerfilPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }

  if (ctx.role === "PERSONAL") {
    const profile = await getPersonalOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding-personal");
    }
    const now = new Date();
    const referenceMonth = currentReferenceMonth(now);
    const [tenant, subscription, finance, overdueCount, ownExercises] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      getSubscriptionForTenant(ctx.tenantId),
      getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth }),
      prisma.studentCharge.count({ where: { tenantId: ctx.tenantId, status: "ATRASADO" } }),
      prisma.exercise.count({ where: { tenantId: ctx.tenantId, status: "ATIVO" } }),
    ]);
    const month = referenceMonthLabel(referenceMonth).split(" ")[0]!.toLowerCase();
    const financeSummary = `${formatCentsBRL(finance.recebidoCents)} recebido em ${month}${overdueCount > 0 ? ` · ${overdueCount} ${overdueCount === 1 ? "atrasada" : "atrasadas"}` : ""}`;

    return (
      <AppShell eyebrow="Perfil" title="Seu perfil" headerMode="mobile" navItems={PERSONAL_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
        <PersonalProfileView
          name={session.user.name}
          email={session.user.email}
          businessName={tenant?.name ?? ""}
          phone={profile.phone}
          cref={profile.cref}
          studentRange={profile.studentRangeEstimate}
          financeSummary={financeSummary}
          subscriptionSummary={subscriptionSummary(subscription, now)}
          exercisesSummary={ownExercises === 0 ? "Biblioteca do FitOS" : `Biblioteca do FitOS + ${ownExercises} ${ownExercises === 1 ? "seu" : "seus"}`}
        />
      </AppShell>
    );
  }

  if (ctx.role === "INDIVIDUAL") {
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding");
    }
    const [tenant, subscription] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      getSubscriptionForTenant(ctx.tenantId),
    ]);

    return (
      <AppShell
        eyebrow="Perfil"
        title="Seu perfil"
        subtitle="Dados da conta e do seu treino."
        navItems={INDIVIDUAL_NAV_ITEMS}
        activeKey="perfil"
        trailing={<LogoutButton />}
      >
        <Card title="Seus dados">
          <p>
            Nome: <strong>{session.user.name}</strong>
          </p>
          <p>
            E-mail: <strong>{session.user.email}</strong>
          </p>
        </Card>

        {tenant ? (
          <Card title="Seu espaço">
            <p>
              Nome: <strong>{tenant.name}</strong>
            </p>
          </Card>
        ) : null}

        <Card title="Seu treino">
          <p>
            Objetivo: <strong>{OBJECTIVE_LABELS[profile.objective]}</strong>
          </p>
          <p>
            Experiência: <strong>{EXPERIENCE_LABELS[profile.experienceLevel]}</strong>
          </p>
          <p>
            Disponibilidade: <strong>{AVAILABILITY_LABELS[profile.weeklyAvailability]}</strong>
          </p>
        </Card>

        <Card title="Assinatura">
          {subscription && subscription.plan ? (
            <p>
              Plano atual: <strong>{subscription.plan.name}</strong>
            </p>
          ) : (
            <p>Nenhuma assinatura contratada ainda.</p>
          )}
          <Button href="/painel/assinatura" variant="outlined">
            Gerenciar assinatura
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (ctx.role !== "ALUNO" || !ctx.studentId) {
    redirect("/painel");
  }

  return (
    <AppShell eyebrow="Perfil" title="Sua conta" subtitle="Seus dados de acesso ao FitOS." navItems={ALUNO_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
      <Card title="Dados da conta">
        <p>
          Nome: <strong>{session.user.name}</strong>
        </p>
        <p>
          E-mail: <strong>{session.user.email}</strong>
        </p>
      </Card>
    </AppShell>
  );
}
