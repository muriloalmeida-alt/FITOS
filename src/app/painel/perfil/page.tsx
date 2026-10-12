import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getPersonalOnboardingProfile } from "@/modules/personal-onboarding/onboarding";
import { getSubscriptionForTenant, type SaasSubscriptionWithPlan } from "@/modules/billing/subscriptions";
import { getOwnFreeAccess } from "@/modules/billing/accessGrants";
import { getReferralSummary } from "@/modules/billing/referrals";
import { featureEnabled } from "@/shared/config/features";
import { accessDateLabel, grantOutlastsTrial } from "@/shared/lib/accessDates";
import { getFinancialSummary } from "@/modules/student-finance/charges";
import { formatCentsBRL } from "@/shared/lib/money";
import { currentReferenceMonth, referenceMonthLabel } from "@/shared/lib/referenceMonth";
import { PersonalProfileView } from "./PersonalProfileView";
import { StudentProfileView } from "./StudentProfileView";
import { getOrCreateInviteCode } from "@/modules/students/inviteLink";
import { LivreProfileView } from "./LivreProfileView";
import { UpdateVersion } from "../../_version/UpdateVersion";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { storedModalities } from "@/shared/lib/modalities";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";

export const metadata: Metadata = {
  title: `Perfil — ${appName}`,
};

/// Resumo de "Minha assinatura": a gratuidade concedida pela equipe FitOS
/// vem antes do teste grátis quando vai além dele (com o ano, se não for
/// este ano), para o cliente nunca ver só o teste inicial.
function subscriptionSummary(subscription: SaasSubscriptionWithPlan | null, now: Date, freeUntil: Date | null = null): string {
  if (!subscription) return "Nenhum plano contratado";
  if (subscription.status === "CANCELADA") return `${subscription.plan.name} · cancelada`;
  if (subscription.status === "INADIMPLENTE") return `${subscription.plan.name} · pagamento pendente`;
  if (grantOutlastsTrial(subscription.trialEndsAt, freeUntil, now)) return `Gratuito até ${accessDateLabel(new Date(freeUntil.getTime() - 1), now)}`;
  if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
    const days = Math.max(1, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
    return `Teste grátis · ${days === 1 ? "último dia" : `${days} dias restantes`}`;
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
    const [tenant, subscription, finance, overdueCount, ownExercises, freeAccess] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      getSubscriptionForTenant(ctx.tenantId),
      getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth }),
      prisma.studentCharge.count({ where: { tenantId: ctx.tenantId, status: "ATRASADO" } }),
      prisma.exercise.count({ where: { tenantId: ctx.tenantId, status: "ATIVO" } }),
      getOwnFreeAccess(ctx.tenantId),
    ]);
    const month = referenceMonthLabel(referenceMonth).split(" ")[0]!.toLowerCase();
    const financeSummary = `${formatCentsBRL(finance.recebidoCents)} recebido em ${month}${overdueCount > 0 ? ` · ${overdueCount} ${overdueCount === 1 ? "atrasada" : "atrasadas"}` : ""}`;

    return (
      <AppShell title="Meu perfil" headerMode="mobile" navItems={PERSONAL_NAV_ITEMS} activeKey="perfil" hideAccount>
        <PersonalProfileView
          name={session.user.name}
          image={session.user.image ?? null}
          email={session.user.email}
          businessName={tenant?.name ?? ""}
          phone={profile.phone}
          cref={profile.cref}
          studentRange={profile.studentRangeEstimate}
          financeSummary={financeSummary}
          subscriptionSummary={subscriptionSummary(subscription, now, freeAccess?.endsAt ?? null)}
          exercisesSummary={ownExercises === 0 ? "Biblioteca do FitOS" : `Biblioteca do FitOS + ${ownExercises} ${ownExercises === 1 ? "seu" : "seus"}`}
        />
        <UpdateVersion />
      </AppShell>
    );
  }

  if (ctx.role === "INDIVIDUAL") {
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding");
    }
    const [tenant, subscription, settings, self, workouts, freeAccess, referral] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      getSubscriptionForTenant(ctx.tenantId),
      prisma.notificationSettings.findUnique({ where: { userId: ctx.userId } }),
      prisma.student.findUnique({ where: { userId: ctx.userId }, select: { preferredDays: true } }),
      prisma.workout.findMany({ where: { tenantId: ctx.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } }, select: { suggestedDays: true } }),
      getOwnFreeAccess(ctx.tenantId),
      // Indicação de amigos: os prêmios são cupons.
      featureEnabled("CUPONS") ? getReferralSummary(ctx.tenantId).catch(() => null) : null,
    ]);

    return (
      <AppShell title="Meu perfil" headerMode="mobile" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="perfil" hideAccount>
        <LivreProfileView
          name={session.user.name}
          image={session.user.image ?? null}
          email={session.user.email}
          spaceName={tenant?.name ?? ""}
          objective={profile.objective}
          experienceLevel={profile.experienceLevel}
          weeklyAvailability={profile.weeklyAvailability}
          subscriptionSummary={subscriptionSummary(subscription, new Date(), freeAccess?.endsAt ?? null)}
          modalities={storedModalities(profile.modalities)}
          preferences={{ reminderHour: settings?.reminderHour ?? null, days: self?.preferredDays ?? [], planDays: [...new Set(workouts.flatMap((workout) => workout.suggestedDays))], coachFirst: null }}
          referral={referral}
        />
        <UpdateVersion />
      </AppShell>
    );
  }

  if (ctx.role !== "ALUNO" || !ctx.studentId) {
    redirect("/painel");
  }

  const [student, settings, assignment, inviteCode] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: ctx.studentId },
      include: { tenant: { include: { owner: true, personalProfile: { select: { cref: true } } } } },
    }),
    prisma.notificationSettings.findUnique({ where: { userId: ctx.userId } }),
    prisma.planAssignment.findFirst({ where: { tenantId: ctx.tenantId, studentId: ctx.studentId, active: true }, select: { trainingPlan: { select: { workouts: { select: { suggestedDays: true } } } } } }),
    getOrCreateInviteCode(ctx.tenantId).catch(() => null),
  ]);

  return (
    <AppShell title="Meu perfil" headerMode="mobile" navItems={ALUNO_NAV_ITEMS} activeKey="perfil" hideAccount>
      <StudentProfileView
        name={session.user.name}
        image={session.user.image ?? null}
        email={session.user.email}
        coach={{ name: student.tenant.owner.name, image: student.tenant.owner.image, businessName: student.tenant.name, cref: student.tenant.personalProfile?.cref ?? null }}
        preferences={{
          reminderHour: settings?.reminderHour ?? null,
          days: student.preferredDays,
          planDays: [...new Set((assignment?.trainingPlan.workouts ?? []).flatMap((workout) => workout.suggestedDays))],
          coachFirst: student.tenant.owner.name.trim().split(/\s+/)[0] ?? null,
        }}
        modalities={storedModalities(student.modalities)}
        invitePath={inviteCode ? `/c/${inviteCode}?ref=${student.id}` : null}
      />
      <UpdateVersion />
    </AppShell>
  );
}
