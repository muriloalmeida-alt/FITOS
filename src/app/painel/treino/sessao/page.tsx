import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { getTodayScheduleForStudent } from "@/modules/workouts/workouts";
import { LogoutButton } from "../../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../../navigation";
import { ComecarTreinoButton } from "./ComecarTreinoButton";
import { SessaoExecucao } from "./SessaoExecucao";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Sessão de treino — ${appName}`,
};

/// Execução de sessão de treino (FIT-041), exclusiva do papel ALUNO —
/// `requireStudent()` garante isso no servidor, mesmo padrão da FIT-016/033.
/// Prioriza retomar uma sessão `EM_ANDAMENTO` já existente (independente
/// de qual treino ela é — "continuar" é literal); só then verifica se há
/// um treino previsto para hoje a começar.
export default async function SessaoPage() {
  let ctx;
  try {
    ctx = await requireStudent();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const inProgress = await getInProgressSessionForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });

  if (inProgress) {
    return (
      <AppShell title="Sessão de treino" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
        <Card title={inProgress.workout.name}>
          <SessaoExecucao
            sessionId={inProgress.id}
            items={inProgress.workout.workoutExercises.map((item) => {
              const result = inProgress.results.find((r) => r.workoutExerciseId === item.id) ?? null;
              return {
                id: item.id,
                exerciseName: item.exercise.name,
                exerciseMuscle: item.exercise.muscle,
                instructions: item.exercise.instructions,
                sets: item.sets,
                reps: item.reps,
                durationSeconds: item.durationSeconds,
                load: item.load,
                restSeconds: item.restSeconds,
                notes: item.notes,
                result: result
                  ? {
                      setsCompleted: result.setsCompleted,
                      repsCompleted: result.repsCompleted,
                      durationSecondsCompleted: result.durationSecondsCompleted,
                      loadUsed: result.loadUsed,
                    }
                  : null,
              };
            })}
          />
        </Card>
      </AppShell>
    );
  }

  const schedule = await getTodayScheduleForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });

  if (schedule.state === "TREINO_HOJE") {
    return (
      <AppShell title="Sessão de treino" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
        <Card title={schedule.workout.name}>
          <p className={styles.empty}>Pronto para começar o treino de hoje?</p>
          <ComecarTreinoButton workoutId={schedule.workout.id} />
        </Card>
      </AppShell>
    );
  }

  const mensagem =
    schedule.state === "SEM_PLANO"
      ? "Você ainda não tem um programa de treino atribuído. Fale com seu personal."
      : schedule.state === "PLANO_ENCERRADO"
        ? `Seu programa "${schedule.planName}" foi encerrado. Fale com seu personal para receber um novo.`
        : "Hoje é dia de descanso. Nenhum treino previsto para hoje.";

  return (
    <AppShell title="Sessão de treino" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
      <Card title="Nenhuma sessão para iniciar">
        <p className={styles.empty}>{mensagem}</p>
      </Card>
    </AppShell>
  );
}
