import { getReferralSummary } from "@/modules/billing/referrals";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { getServerSession } from "@/modules/identity/session";
import { listDevices } from "@/modules/identity/devices";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getInviteDefaults } from "@/modules/students/inviteLink";
import { getLibrary } from "@/modules/library/library";
import { getTenantPrescription } from "@/modules/workouts/workouts";
import { getAlertSettings } from "@/modules/notifications/personalAlerts";
import { getPaymentAccountSummary } from "@/modules/student-finance/paymentAccount";
import { getBalanceCents, refreshAccountStatus } from "@/modules/student-finance/asaasSubaccount";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { ConfiguracoesView } from "./ConfiguracoesView";

export const metadata: Metadata = {
  title: `Configurações — ${appName}`,
};

/// Configurações do personal (EPIC-36): padrões de treino e de novo aluno,
/// avisos no celular, segurança (senha e aparelhos) e seus dados.
export default async function ConfiguracoesPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const session = await getServerSession();
  const [prescription, invite, library, alerts, devices, password, payments] = await Promise.all([
    getTenantPrescription(ctx.tenantId),
    getInviteDefaults(ctx.tenantId),
    getLibrary({ tenantId: ctx.tenantId }),
    getAlertSettings(ctx.userId),
    listDevices({ userId: ctx.userId, currentSessionId: session?.session.id ?? null }),
    prisma.account.findFirst({ where: { userId: ctx.userId, providerId: "credential", password: { not: null } }, select: { id: true } }),
    // Recebimento (EPIC-38): atualiza a verificação no Asaas antes de mostrar.
    refreshAccountStatus({ tenantId: ctx.tenantId }).then(() => getPaymentAccountSummary(ctx.tenantId)),
  ]);
  const [balanceCents, owner, referral] = await Promise.all([
    payments.status === "NAO_ATIVADO" ? null : getBalanceCents(ctx.tenantId),
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true } }),
    getReferralSummary(ctx.tenantId).catch(() => null),
  ]);

  return (
    <AppShell eyebrow="Conta" title="Configurações" navItems={PERSONAL_NAV_ITEMS} activeKey="config" trailing={<LogoutButton />}>
      <ConfiguracoesView
        prescription={prescription}
        invite={invite}
        programs={library.programs.map((program) => ({ id: program.id, name: program.name, meta: program.meta }))}
        alerts={alerts}
        devices={devices.map((device) => ({ id: device.id, label: device.label, lastActiveIso: device.lastActive.toISOString(), current: device.current }))}
        hasPassword={password !== null}
        referral={referral}
        payments={{ ...payments, balanceCents, ownerName: owner.name }}
      />
    </AppShell>
  );
}
