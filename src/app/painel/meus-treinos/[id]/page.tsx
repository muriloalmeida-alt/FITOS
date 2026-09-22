import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { getWorkoutForTenant, listWorkoutExercisesForWorkout } from "@/modules/workouts/workouts";
import { listCatalogExercises } from "@/modules/exercises/exercises";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { EditarMeuTreinoForm } from "./EditarMeuTreinoForm";
import { ItensDoMeuTreino } from "./ItensDoMeuTreino";
import { ArquivarMeuTreinoButton } from "./ArquivarMeuTreinoButton";
import { ReativarMeuTreinoButton } from "./ReativarMeuTreinoButton";
import { DuplicarMeuTreinoButton } from "./DuplicarMeuTreinoButton";
import { ComecarMeuTreinoButton } from "./ComecarMeuTreinoButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treino — ${appName}`,
};

interface MeuTreinoDetalhePageProps {
  params: Promise<{ id: string }>;
}

const CATALOG_PAGE_SIZE_FOR_PICKER = 100;

/// Detalhe/builder de um treino do workspace individual (FIT-102). Busca
/// sempre pelo tenant da sessão (`getWorkoutForTenant`) — um treino de
/// outro tenant nunca é encontrado, e a resposta (404) não revela se
/// aquele `id` existe em outro tenant. Reaproveita `listCatalogExercises`
/// (FIT-023) sem alteração — o catálogo local abastecido pela IMP-EX-001 é
/// o mesmo para qualquer tenant, `PERSONAL` ou `INDIVIDUAL`.
export default async function MeuTreinoDetalhePage({ params }: MeuTreinoDetalhePageProps) {
  let ctx;
  try {
    ctx = await requireIndividual();
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
    listCatalogExercises({ tenantId: ctx.tenantId, pageSize: CATALOG_PAGE_SIZE_FOR_PICKER }),
  ]);

  return (
    <AppShell title={workout.name} navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Link href="/painel/meus-treinos" className={styles.backLink}>
        ← Voltar para meus treinos
      </Link>

      <Card title="Dados do treino">
        <p className={styles.statusLine}>
          Status: <span className={workout.status === "ATIVO" ? styles.statusAtivo : styles.statusArquivado}>
            {workout.status === "ATIVO" ? "Ativo" : "Arquivado"}
          </span>
        </p>
        <EditarMeuTreinoForm workoutId={workout.id} initialName={workout.name} />
      </Card>

      {workout.status === "ATIVO" ? (
        <Card title="Executar">
          <ComecarMeuTreinoButton workoutId={workout.id} />
        </Card>
      ) : null}

      <Card title="Exercícios do treino">
        <ItensDoMeuTreino
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
          catalog={catalog.items.map((exercise) => ({ id: exercise.id, name: exercise.name }))}
        />
      </Card>

      <Card title="Duplicar">
        <p className={styles.duplicateHint}>Cria uma cópia independente deste treino — editar a cópia nunca afeta o original.</p>
        <DuplicarMeuTreinoButton workoutId={workout.id} />
      </Card>

      <Card title="Ciclo de vida">
        {workout.status === "ATIVO" ? (
          <ArquivarMeuTreinoButton workoutId={workout.id} />
        ) : (
          <ReativarMeuTreinoButton workoutId={workout.id} />
        )}
      </Card>
    </AppShell>
  );
}
