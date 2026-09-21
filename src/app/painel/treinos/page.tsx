import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listWorkoutsForTenant } from "@/modules/workouts/workouts";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { TreinosSubNav } from "./TreinosSubNav";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treinos — ${appName}`,
};

/// Lista de modelos de treino do tenant (FIT-030). Planos semanais
/// (agrupando modelos, dias e vigência) ficam em `/painel/treinos/planos`
/// (FIT-032) — ver `TreinosSubNav`.
export default async function TreinosPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const workouts = await listWorkoutsForTenant({ tenantId: ctx.tenantId });

  return (
    <AppShell title="Treinos" navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TreinosSubNav active="modelos" />
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {workouts.length} {workouts.length === 1 ? "modelo de treino" : "modelos de treino"}
        </p>
        <Button href="/painel/treinos/novo" variant="filled">
          + Criar modelo
        </Button>
      </div>

      {workouts.length === 0 ? (
        <p className={styles.empty}>Nenhum modelo de treino ainda. Crie o primeiro para começar a montar planos.</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de modelos de treino">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link href={`/painel/treinos/${workout.id}`} className={styles.row}>
                <span className={styles.cellName}>{workout.name}</span>
                {workout.suggestedDays.length > 0 ? (
                  <span className={styles.cellDays}>{workout.suggestedDays.join(", ")}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
