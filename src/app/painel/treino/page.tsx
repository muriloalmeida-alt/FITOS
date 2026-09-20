import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { getActivePlanAssignmentForStudent, listEndedPlanAssignmentsForStudent } from "@/modules/workouts/workouts";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treino — ${appName}`,
};

interface WorkoutItemView {
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
}

function prescriptionSummary(item: WorkoutItemView): string {
  const parts: string[] = [];
  if (item.sets) {
    parts.push(`${item.sets} série${item.sets > 1 ? "s" : ""}`);
  }
  if (item.reps) {
    parts.push(`${item.reps} repetiç${item.reps > 1 ? "ões" : "ão"}`);
  }
  if (item.durationSeconds) {
    parts.push(`${item.durationSeconds}s de duração`);
  }
  if (item.load) {
    parts.push(`carga: ${item.load}`);
  }
  if (item.restSeconds) {
    parts.push(`descanso: ${item.restSeconds}s`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Sem parâmetros de prescrição";
}

/// Visão somente leitura do plano atribuído (FIT-033), exclusiva do papel
/// ALUNO — `requireStudent()` garante isso no servidor, mesmo padrão da
/// página de perfil (FIT-016). Sempre lê a atribuição ATIVA do próprio
/// aluno da sessão (nunca um `studentId` vindo do cliente) e sempre o
/// plano-snapshot (imutável desde a atribuição) — nunca o plano editável
/// do personal.
export default async function TreinoAlunoPage() {
  let ctx;
  try {
    ctx = await requireStudent();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const active = await getActivePlanAssignmentForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });

  if (!active) {
    const ended = await listEndedPlanAssignmentsForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });
    const mensagem =
      ended.length > 0
        ? `Seu programa "${ended[0]!.trainingPlan.name}" foi encerrado. Fale com seu personal para receber um novo.`
        : "Você ainda não tem um programa de treino atribuído. Fale com seu personal.";

    return (
      <AppShell title="Treino" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
        <Card title="Seu programa">
          <p className={styles.empty}>{mensagem}</p>
        </Card>
      </AppShell>
    );
  }

  const { trainingPlan } = active;

  return (
    <AppShell title="Treino" navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
      <Card title={trainingPlan.name}>
        {trainingPlan.durationWeeks ? (
          <p className={styles.planMeta}>Vigência sugerida: {trainingPlan.durationWeeks} semanas</p>
        ) : null}

        {trainingPlan.workouts.length === 0 ? (
          <p className={styles.empty}>Este programa ainda não tem modelos de treino.</p>
        ) : (
          <div className={styles.workoutList}>
            {trainingPlan.workouts.map((workout) => (
              <div key={workout.id}>
                <p className={styles.workoutName}>{workout.name}</p>
                {workout.suggestedDays.length > 0 ? (
                  <p className={styles.days}>{workout.suggestedDays.join(", ")}</p>
                ) : null}

                {workout.workoutExercises.length === 0 ? (
                  <p className={styles.empty}>Nenhum exercício neste modelo ainda.</p>
                ) : (
                  <ul className={styles.itemList} aria-label={`Exercícios de ${workout.name}, em ordem`}>
                    {workout.workoutExercises.map((item) => (
                      <li key={item.id} className={styles.itemRow}>
                        <span className={styles.exerciseName}>{item.exercise.name}</span>
                        {item.exercise.muscle ? <span className={styles.exerciseMuscle}>{item.exercise.muscle}</span> : null}
                        <span className={styles.summary}>{prescriptionSummary(item)}</span>
                        {item.notes ? <span className={styles.notes}>{item.notes}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
