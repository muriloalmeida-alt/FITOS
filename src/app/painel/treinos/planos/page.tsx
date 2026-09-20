import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listTrainingPlansForTenant } from "@/modules/workouts/workouts";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { TreinosSubNav } from "../TreinosSubNav";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: `Programas — ${appName}`,
};

/// Lista de planos semanais do tenant (FIT-032). Agrupam modelos de
/// treino (FIT-030/031) com dias sugeridos e vigência sugerida.
export default async function PlanosPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const plans = await listTrainingPlansForTenant({ tenantId: ctx.tenantId });

  return (
    <AppShell title="Treinos" navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TreinosSubNav active="planos" />
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {plans.length} {plans.length === 1 ? "programa" : "programas"}
        </p>
        <Link href="/painel/treinos/planos/novo">
          <Button type="button" variant="filled">
            + Criar programa
          </Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className={styles.empty}>Nenhum programa ainda. Crie o primeiro para agrupar seus modelos de treino.</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de programas">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link href={`/painel/treinos/planos/${plan.id}`} className={styles.row}>
                <span className={styles.cellName}>{plan.name}</span>
                {plan.durationWeeks ? <span className={styles.cellDays}>{plan.durationWeeks} semanas</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
