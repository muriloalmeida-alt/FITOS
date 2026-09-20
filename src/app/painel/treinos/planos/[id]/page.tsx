import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getTrainingPlanForTenant, listWorkoutsAvailableForPlan, listWorkoutsInPlan } from "@/modules/workouts/workouts";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { EditarPlanoForm } from "./EditarPlanoForm";
import { ModelosDoPrograma } from "./ModelosDoPrograma";
import { ArquivarPlanoButton } from "./ArquivarPlanoButton";
import { ReativarPlanoButton } from "./ReativarPlanoButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Programa — ${appName}`,
};

interface PlanoDetalhePageProps {
  params: Promise<{ id: string }>;
}

/// Detalhe do plano semanal (FIT-032). Busca sempre pelo tenant da sessão
/// e nunca um snapshot (`getTrainingPlanForTenant`) — um plano de outro
/// tenant, ou uma cópia imutável de atribuição (FIT-033/ADR-005), nunca é
/// encontrado por esta via.
export default async function PlanoDetalhePage({ params }: PlanoDetalhePageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const plan = await getTrainingPlanForTenant({ tenantId: ctx.tenantId, trainingPlanId: id });
  if (!plan) {
    notFound();
  }

  const [workouts, availableWorkouts] = await Promise.all([
    listWorkoutsInPlan({ tenantId: ctx.tenantId, trainingPlanId: id }),
    listWorkoutsAvailableForPlan({ tenantId: ctx.tenantId, excludeTrainingPlanId: id }),
  ]);

  return (
    <AppShell title={plan.name} navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Link href="/painel/treinos/planos" className={styles.backLink}>
        ← Voltar para os programas
      </Link>

      <Card title="Dados do programa">
        <p className={styles.statusLine}>
          Status:{" "}
          <span className={plan.status === "ATIVO" ? styles.statusAtivo : styles.statusArquivado}>
            {plan.status === "ATIVO" ? "Ativo" : "Arquivado"}
          </span>
        </p>
        <EditarPlanoForm trainingPlanId={plan.id} initialName={plan.name} initialDurationWeeks={plan.durationWeeks} />
      </Card>

      <Card title="Modelos do programa">
        <ModelosDoPrograma
          trainingPlanId={plan.id}
          workouts={workouts.map((workout) => ({ id: workout.id, name: workout.name, suggestedDays: workout.suggestedDays }))}
          availableWorkouts={availableWorkouts.map((workout) => ({ id: workout.id, name: workout.name }))}
        />
      </Card>

      <Card title="Ciclo de vida">
        {plan.status === "ATIVO" ? (
          <ArquivarPlanoButton trainingPlanId={plan.id} />
        ) : (
          <ReativarPlanoButton trainingPlanId={plan.id} />
        )}
      </Card>
    </AppShell>
  );
}
