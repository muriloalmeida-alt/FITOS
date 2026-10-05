import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, EmptyStateAction, NextStepCard, WeekStrip } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { weekStripFromDays } from "@/shared/lib/weekdays";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listTrainingPlanSummariesForTenant } from "@/modules/workouts/workouts";
import { FilterLinks } from "../../_workout-builder/FilterLinks";
import { TrainingTabs } from "../../_workout-builder/TrainingTabs";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Programas — ${appName}`,
};

interface ProgramasPageProps {
  searchParams?: Promise<{ arquivados?: string }>;
}

/// Programas do Personal (FIT-146): "Montar um programa" como próximo
/// passo, filtros Ativos/Arquivados e cada programa com a faixa da semana.
export default async function ProgramasPage({ searchParams }: ProgramasPageProps = {}) {
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
    listTrainingPlanSummariesForTenant({ tenantId: ctx.tenantId }),
    listTrainingPlanSummariesForTenant({ tenantId: ctx.tenantId, status: "ARQUIVADO" }),
  ]);
  const shown = archived ? old : active;

  return (
    <AppShell eyebrow="Treinos" title="Monte, organize, atribua." navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TrainingTabs active="programas" />
      <div className={styles.next}>
        <NextStepCard eyebrow="Próximo passo" title="Montar um programa" description="Junte treinos e atribua a quem precisa." href="/painel/treinos/planos/novo" />
      </div>
      <FilterLinks
        label="Filtrar programas"
        items={[
          { label: `Ativos · ${active.length}`, href: "/painel/treinos/planos", active: !archived },
          { label: `Arquivados · ${old.length}`, href: "/painel/treinos/planos?arquivados=1", active: archived },
        ]}
      />
      {shown.length === 0 ? (
        archived ? (
          <p className={styles.meta}>Programas arquivados continuam valendo para quem já recebeu.</p>
        ) : (
          <EmptyStateAction title="Nenhum programa ainda" description="Junte seus treinos numa semana e atribua aos alunos." action={{ label: "Montar um programa", href: "/painel/treinos/planos/novo" }} />
        )
      ) : (
        <ul className={styles.list} aria-label="Seus programas">
          {shown.map((plan) => (
            <li key={plan.id}>
              <Link href={`/painel/treinos/planos/${plan.id}`} className={styles.card}>
                <span className={styles.name}>{plan.name}</span>
                <span className={styles.meta}>
                  {plan.durationWeeks ? `${plan.durationWeeks} semanas · ` : ""}
                  {plan.workoutCount} {plan.workoutCount === 1 ? "treino" : "treinos"} · {plan.days.length} {plan.days.length === 1 ? "dia" : "dias"} por semana
                </span>
                <span className={styles.strip}>
                  <WeekStrip days={weekStripFromDays(plan.days)} label={`Semana de ${plan.name}`} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
