import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, EmptyStateAction, NextStepCard } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listWorkoutSummariesForTenant } from "@/modules/workouts/workouts";
import { FilterLinks } from "../_workout-builder/FilterLinks";
import { TrainingTabs } from "../_workout-builder/TrainingTabs";
import { WorkoutSummaryList } from "../_workout-builder/WorkoutSummaryList";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treinos — ${appName}`,
};

interface TreinosPageProps {
  searchParams?: Promise<{ arquivados?: string }>;
}

/// Treinos do Personal (FIT-146, P4 do protótipo): "Montar um treino" como
/// próximo passo, filtros Ativos/Arquivados e a lista com ações de um
/// toque. Programas e Exercícios são abas da mesma área.
export default async function TreinosPage({ searchParams }: TreinosPageProps = {}) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const archived = (await searchParams)?.arquivados === "1";
  const [active, old] = await Promise.all([
    listWorkoutSummariesForTenant({ tenantId: ctx.tenantId }),
    listWorkoutSummariesForTenant({ tenantId: ctx.tenantId, status: "ARQUIVADO" }),
  ]);
  const shown = archived ? old : active;

  return (
    <AppShell eyebrow="Treinos" title="Monte, organize, atribua." subtitle="Tudo começa pela biblioteca. Nada de formulário." navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TrainingTabs active="treinos" />
      <div className={styles.next}>
        <NextStepCard eyebrow="Próximo passo" title="Montar um treino" description="Escolha os exercícios e ajuste com um toque." href="/painel/treinos/novo" />
      </div>
      <FilterLinks
        label="Filtrar treinos"
        items={[
          { label: `Ativos · ${active.length}`, href: "/painel/treinos", active: !archived },
          { label: `Arquivados · ${old.length}`, href: "/painel/treinos?arquivados=1", active: archived },
        ]}
      />
      {shown.length === 0 ? (
        archived ? (
          <p className={styles.empty}>Treinos arquivados ficam guardados aqui e podem voltar quando você quiser.</p>
        ) : (
          <EmptyStateAction title="Nenhum treino ainda" description="Monte o primeiro pela biblioteca: leva um minuto." action={{ label: "Montar um treino", href: "/painel/treinos/novo" }} />
        )
      ) : (
        <WorkoutSummaryList area="personal" workouts={shown} />
      )}
    </AppShell>
  );
}
