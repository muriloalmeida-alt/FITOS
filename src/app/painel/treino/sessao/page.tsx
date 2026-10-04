import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { getLastPerformanceForExercises } from "@/modules/execution/sets";
import { getActivePlanAssignmentForStudent, getTodayScheduleForStudent } from "@/modules/workouts/workouts";
import { LogoutButton } from "../../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../../navigation";
import { LiveWorkout } from "../../_live/LiveWorkout";
import { toLiveItems } from "../../_live/liveItems";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treino ao vivo — ${appName}`,
};

/// Treino ao vivo do aluno (FIT-153), sem barra inferior. Retoma a sessão
/// em andamento (mesmo depois de fechar o app); senão mostra a preparação
/// do treino escolhido em "Seu programa" (`?treino=`) ou do treino de hoje.
export default async function SessaoPage({ searchParams }: { searchParams?: Promise<{ treino?: string }> } = {}) {
  let ctx;
  try {
    ctx = await requireStudent();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const scope = { tenantId: ctx.tenantId, studentId: ctx.studentId };
  const [inProgress, student] = await Promise.all([
    getInProgressSessionForStudent(scope),
    prisma.student.findUniqueOrThrow({ where: { id: ctx.studentId }, include: { tenant: { include: { owner: true } } } }),
  ]);
  const coachName = student.tenant.owner.name;
  const common = { coachName, apiBase: "/api/workout-sessions", exitHref: "/painel", progressHref: "/painel/progresso" };

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
      />
    );
  }

  const sp = (await searchParams) ?? {};
  const active = await getActivePlanAssignmentForStudent(scope);
  const chosen = sp.treino ? (active?.trainingPlan.workouts.find((workout) => workout.id === sp.treino && workout.status === "ATIVO") ?? null) : null;
  const schedule = chosen ? null : await getTodayScheduleForStudent(scope);
  const workout = chosen ?? (schedule?.state === "TREINO_HOJE" ? schedule.workout : null);

  if (workout && workout.workoutExercises.length > 0) {
    const last = await getLastPerformanceForExercises({ ...scope, exerciseIds: workout.workoutExercises.map((item) => item.exerciseId) });
    return <LiveWorkout {...common} sessionId={null} workoutId={workout.id} workoutName={workout.name} startedAt={null} items={toLiveItems(workout.workoutExercises, [], last)} />;
  }

  const message =
    schedule?.state === "SEM_PLANO"
      ? `${coachName} ainda vai montar seu programa.`
      : schedule?.state === "PLANO_ENCERRADO"
        ? `Seu programa "${schedule.planName}" terminou. ${coachName} já foi avisado.`
        : "Hoje é descanso. Quer treinar mesmo assim? Escolha um treino no seu programa.";

  return (
    <AppShell eyebrow="Treino" title="Nada para hoje" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
      <p className={styles.empty}>{message}</p>
      {active ? (
        <Button href="/painel/treino" variant="secondary">
          Ver meu programa
        </Button>
      ) : null}
    </AppShell>
  );
}
