import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getPersonalOnboardingProfile } from "@/modules/personal-onboarding/onboarding";
import { studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { LogoutButton } from "../LogoutButton";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "../individualProfileLabels";

export const metadata: Metadata = {
  title: `Perfil — ${appName}`,
};

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
    const [tenant, subscription] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      getSubscriptionForTenant(ctx.tenantId),
    ]);

    return (
      <AppShell eyebrow="Perfil" title="Seu perfil" subtitle="Dados da conta e do seu espaço." navItems={PERSONAL_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
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

        <Card title="Perfil profissional">
          <p>
            Celular: <strong>{profile.phone}</strong>
          </p>
          <p>
            CREF: <strong>{profile.cref ?? "Não informado"}</strong>
          </p>
          <p>
            Faixa de alunos: <strong>{studentRangeLabel(profile.studentRangeEstimate)}</strong>
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
