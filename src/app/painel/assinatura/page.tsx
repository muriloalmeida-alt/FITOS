import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { formatCentsBRL } from "@/shared/lib/money";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { SelecionarPlanoButton } from "./SelecionarPlanoButton";
import { CancelarAssinaturaForm } from "./CancelarAssinaturaForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Assinatura — ${appName}`,
};

const BILLING_CYCLE_LABEL: Record<string, string> = {
  MENSAL: "mês",
  ANUAL: "ano",
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ATIVA: "Ativa",
  INADIMPLENTE: "Inadimplente",
  CANCELADA: "Cancelada",
};

/// Gestão da assinatura SaaS do FitOS (FIT-122) — exclusiva de `PERSONAL`
/// (o próprio negócio) e `INDIVIDUAL` (FitOS Livre, FIT-105), nunca de
/// `ALUNO` (que não assina nada diretamente). Todo plano exibido tem preço
/// zero neste momento (nenhum gateway de pagamento integrado, FIT-091) —
/// a contratação aqui é real (grava `SaasSubscription`), só a cobrança em
/// si ainda não existe.
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

  const [subscription, plans] = await Promise.all([
    getSubscriptionForTenant(ctx.tenantId),
    listActivePlansForAudience(ctx.tenantType),
  ]);

  const navItems = ctx.role === "PERSONAL" ? PERSONAL_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS;
  const isActiveSubscription = subscription?.status === "ATIVA";

  return (
    <AppShell title="Assinatura" navItems={navItems} activeKey="assinatura" trailing={<LogoutButton />}>
      <Card title="Sua assinatura">
        {subscription && subscription.plan ? (
          <div className={styles.currentPlan}>
            <p className={styles.planName}>{subscription.plan.name}</p>
            <p className={styles.planPrice}>
              {formatCentsBRL(subscription.plan.priceCents)} / {BILLING_CYCLE_LABEL[subscription.plan.billingCycle] ?? "mês"}
            </p>
            <p className={styles.planStatus}>
              Status: <strong>{SUBSCRIPTION_STATUS_LABEL[subscription.status] ?? subscription.status}</strong>
            </p>
            {subscription.status === "CANCELADA" && subscription.canceledReason ? (
              <p className={styles.canceledReason}>Motivo do cancelamento: {subscription.canceledReason}</p>
            ) : null}
          </div>
        ) : (
          <p>Nenhuma assinatura contratada ainda.</p>
        )}
      </Card>

      <Card title="Planos disponíveis">
        {plans.length === 0 ? (
          <p>Nenhum plano disponível no momento.</p>
        ) : (
          <ul className={styles.planList}>
            {plans.map((plan) => {
              const isCurrentPlan = isActiveSubscription && subscription?.planId === plan.id;
              return (
                <li key={plan.id} className={styles.planItem}>
                  <div>
                    <p className={styles.planName}>{plan.name}</p>
                    {plan.description ? <p className={styles.planDescription}>{plan.description}</p> : null}
                    <p className={styles.planPrice}>
                      {formatCentsBRL(plan.priceCents)} / {BILLING_CYCLE_LABEL[plan.billingCycle] ?? "mês"}
                    </p>
                    <p className={styles.planLimit}>
                      {plan.studentLimit === null ? "Alunos ativos: sem limite" : `Alunos ativos: até ${plan.studentLimit}`}
                    </p>
                  </div>
                  {isCurrentPlan ? (
                    <span className={styles.currentBadge}>Plano atual</span>
                  ) : (
                    <SelecionarPlanoButton planId={plan.id} label={isActiveSubscription ? "Trocar para este plano" : "Assinar"} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {isActiveSubscription ? (
        <Card title="Cancelar assinatura">
          <CancelarAssinaturaForm />
        </Card>
      ) : null}
    </AppShell>
  );
}
