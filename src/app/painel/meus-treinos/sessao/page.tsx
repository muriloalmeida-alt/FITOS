import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { getLastPerformanceForExercises } from "@/modules/execution/sets";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { LiveWorkout } from "../../_live/LiveWorkout";
import { toLiveItems } from "../../_live/liveItems";
import { loadLibrary } from "../../_workout-builder/editorData";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treino ao vivo — ${appName}`,
};

/// Treino ao vivo do FitOS Livre (FIT-158): o mesmo componente do aluno
/// (FIT-153), sem personal. Retoma a sessão em andamento; senão prepara o
/// treino escolhido (`?treino=`). O fim leva a Minha evolução. Treino
/// avulso: a sessão já existe e os exercícios entram durante o treino.
export default async function SessaoIndividualPage({ searchParams }: { searchParams?: Promise<{ treino?: string }> } = {}) {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
  const scope = { tenantId: ctx.tenantId, studentId: student.id };
  const common = { coachName: null, apiBase: "/api/minhas-sessoes", exitHref: "/painel", progressHref: "/painel/minha-evolucao", doneHref: "/painel/minha-evolucao" };
  const inProgress = await getInProgressSessionForStudent(scope);

  if (inProgress) {
    const items = inProgress.workout.workoutExercises;
    const last = await getLastPerformanceForExercises({ ...scope, exerciseIds: items.map((item) => item.exerciseId), excludeSessionId: inProgress.id });
    return (
      <LiveWorkout
        {...common}
        sessionId={inProgress.id}
        workoutId={inProgress.workoutId}
        workoutName={inProgress.workout.name}
        startedAt={inProgress.startedAt.toISOString()}
        items={toLiveItems(items, inProgress.setResults, last)}
        free={inProgress.workout.status === "AVULSO" ? { library: await loadLibrary(ctx.tenantId) } : undefined}
      />
    );
  }

  const workoutId = (await searchParams)?.treino;
  const workout = workoutId
    ? await prisma.workout.findFirst({
        where: { id: workoutId, tenantId: ctx.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } },
        include: {
          workoutExercises: {
            orderBy: { position: "asc" },
            include: { exercise: { select: { name: true, instructions: true, imageUrl: true, imageAlt: true } } },
          },
        },
      })
    : null;

  if (workout && workout.workoutExercises.length > 0) {
    const last = await getLastPerformanceForExercises({ ...scope, exerciseIds: workout.workoutExercises.map((item) => item.exerciseId) });
    return <LiveWorkout {...common} sessionId={null} workoutId={workout.id} workoutName={workout.name} startedAt={null} items={toLiveItems(workout.workoutExercises, [], last)} />;
  }

  return (
    <AppShell eyebrow="Treino" title="Escolha um treino" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <p className={styles.empty}>{workout ? "Este treino ainda não tem exercícios." : "Escolha um dos seus treinos para começar."}</p>
      <Button href={workout ? `/painel/meus-treinos/${workout.id}` : "/painel/meus-treinos"} variant="secondary">
        {workout ? "Montar o treino" : "Meus treinos"}
      </Button>
    </AppShell>
  );
}
