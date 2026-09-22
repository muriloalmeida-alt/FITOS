import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { listWorkoutsForTenant } from "@/modules/workouts/workouts";
import { LogoutButton } from "../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Meus treinos — ${appName}`,
};

/// Lista dos treinos do workspace individual (FIT-102). Reaproveita
/// `listWorkoutsForTenant` (mesmo módulo do personal, FIT-030) — a
/// função só depende de `tenantId`. Sem nenhum conceito de "plano"
/// visível aqui: cada treino pertence diretamente ao praticante.
export default async function MeusTreinosPage() {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const workouts = await listWorkoutsForTenant({ tenantId: ctx.tenantId });

  return (
    <AppShell title="Meus treinos" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <div className={styles.header}>
        <p className={styles.subtitle}>{workouts.length} {workouts.length === 1 ? "treino" : "treinos"}</p>
        <Button href="/painel/meus-treinos/novo" variant="filled">
          + Criar treino
        </Button>
      </div>

      {workouts.length === 0 ? (
        <p className={styles.empty}>Nenhum treino ainda. Crie o primeiro para começar a treinar.</p>
      ) : (
        <ul className={styles.list} aria-label="Lista dos meus treinos">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link href={`/painel/meus-treinos/${workout.id}`} className={styles.row}>
                <span className={styles.cellName}>{workout.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
