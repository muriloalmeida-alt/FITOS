import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, EmptyStateAction, NextStepCard } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { listWorkoutSummariesForTenant } from "@/modules/workouts/workouts";
import { FilterLinks } from "../_workout-builder/FilterLinks";
import { TrainingTabs } from "../_workout-builder/TrainingTabs";
import { WorkoutSummaryList } from "../_workout-builder/WorkoutSummaryList";
import { LogoutButton } from "../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../navigation";
import styles from "../treinos/page.module.css";

export const metadata: Metadata = {
  title: `Meus treinos — ${appName}`,
};

/// Meus treinos do FitOS Livre (FIT-157, L2 do protótipo): abas Treinos e
/// Exercícios, "Montar meu treino", filtros Ativos/Arquivados e cada
/// treino com Começar, Abrir, Usar como base e Arquivar/Reativar.
export default async function MeusTreinosPage({ searchParams }: { searchParams?: Promise<{ arquivados?: string }> } = {}) {
  let ctx;
  try {
    ctx = await requireIndividual();
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
  const shown = (archived ? old : active).map((workout) => ({ ...workout, trainingPlanName: null }));

  return (
    <AppShell eyebrow="Meus treinos" title="Do seu jeito." subtitle="Monte pela biblioteca e comece com um toque." navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TrainingTabs active="treinos" area="livre" />
      <div className={styles.next}>
        <NextStepCard eyebrow="Próximo passo" title="Montar meu treino" description="Escolha os exercícios. Entram com 3 × 12 e 60 s." href="/painel/meus-treinos/novo" />
      </div>
      <FilterLinks
        label="Filtrar treinos"
        items={[
          { label: `Ativos · ${active.length}`, href: "/painel/meus-treinos", active: !archived },
          { label: `Arquivados · ${old.length}`, href: "/painel/meus-treinos?arquivados=1", active: archived },
        ]}
      />
      {shown.length === 0 ? (
        archived ? (
          <p className={styles.empty}>Treinos arquivados ficam guardados aqui e podem voltar quando você quiser.</p>
        ) : (
          <EmptyStateAction title="Nenhum treino ainda" description="Monte o primeiro pela biblioteca: leva um minuto." action={{ label: "Criar meu primeiro treino", href: "/painel/meus-treinos/novo" }} />
        )
      ) : (
        <WorkoutSummaryList area="livre" workouts={shown} startBase="/painel/meus-treinos/sessao" />
      )}
    </AppShell>
  );
}
