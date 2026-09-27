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
import { ALUNO_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";

export const metadata: Metadata = {
  title: `Perfil — ${appName}`,
};

/// Página de conta/perfil (FIT-016 para o aluno; FIT-120/redesign para o
/// personal). O papel exibido é sempre o da própria sessão (`getAuthContext`,
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
      <AppShell title="Perfil" navItems={PERSONAL_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
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

  if (ctx.role !== "ALUNO" || !ctx.studentId) {
    redirect("/painel");
  }

  return (
    <AppShell title="Sua conta" navItems={ALUNO_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
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
