import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getWorkoutForTenant, listWorkoutExercisesForWorkout } from "@/modules/workouts/workouts";
import { listCatalogExercisesForPicker } from "@/modules/exercises/exercises";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { EditarModeloForm } from "./EditarModeloForm";
import { ItensDoModelo } from "./ItensDoModelo";
import { ArquivarModeloButton } from "./ArquivarModeloButton";
import { ReativarModeloButton } from "./ReativarModeloButton";
import { DuplicarModeloButton } from "./DuplicarModeloButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Modelo de treino — ${appName}`,
};

interface ModeloDetalhePageProps {
  params: Promise<{ id: string }>;
}

/// Detalhe do modelo de treino (FIT-030). Busca sempre pelo tenant da
/// sessão (`getWorkoutForTenant`) — um modelo de outro tenant nunca é
/// encontrado, e a resposta (404) não revela se aquele `id` existe em
/// outro tenant.
export default async function ModeloDetalhePage({ params }: ModeloDetalhePageProps) {
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
  const workout = await getWorkoutForTenant({ tenantId: ctx.tenantId, workoutId: id });
  if (!workout) {
    notFound();
  }

  const [items, catalog] = await Promise.all([
    listWorkoutExercisesForWorkout({ tenantId: ctx.tenantId, workoutId: id }),
    listCatalogExercisesForPicker({ tenantId: ctx.tenantId }),
  ]);

  return (
    <AppShell title={workout.name} navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Link href="/painel/treinos" className={styles.backLink}>
        ← Voltar para os modelos
      </Link>

      <Card title="Dados do modelo">
        <p className={styles.statusLine}>
          Status: <span className={workout.status === "ATIVO" ? styles.statusAtivo : styles.statusArquivado}>
            {workout.status === "ATIVO" ? "Ativo" : "Arquivado"}
          </span>
        </p>
        <EditarModeloForm workoutId={workout.id} initialName={workout.name} initialSuggestedDays={workout.suggestedDays} />
      </Card>

      <Card title="Exercícios do modelo">
        <ItensDoModelo
          workoutId={workout.id}
          items={items.map((item) => ({
            id: item.id,
            exerciseId: item.exerciseId,
            exerciseName: item.exercise.name,
            exerciseMuscle: item.exercise.muscle,
            sets: item.sets,
            reps: item.reps,
            durationSeconds: item.durationSeconds,
            load: item.load,
            restSeconds: item.restSeconds,
            notes: item.notes,
          }))}
          catalog={catalog}
        />
      </Card>

      <Card title="Duplicar">
        <p className={styles.duplicateHint}>Cria uma cópia independente deste modelo — editar a cópia nunca afeta o original.</p>
        <DuplicarModeloButton workoutId={workout.id} />
      </Card>

      <Card title="Ciclo de vida">
        {workout.status === "ATIVO" ? (
          <ArquivarModeloButton workoutId={workout.id} />
        ) : (
          <ReativarModeloButton workoutId={workout.id} />
        )}
      </Card>
    </AppShell>
  );
}
