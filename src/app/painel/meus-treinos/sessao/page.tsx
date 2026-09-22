import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { SessaoExecucaoIndividual } from "./SessaoExecucaoIndividual";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Sessão de treino — ${appName}`,
};

/// Execução de sessão do workspace individual (FIT-103), exclusiva do
/// papel `INDIVIDUAL` — `requireIndividual()` garante isso no servidor.
/// Diferente de `/painel/treino/sessao` (ALUNO): não existe "treino de
/// hoje" aqui — começar um treino é uma ação explícita a partir de
/// `/painel/meus-treinos/[id]` (`ComecarMeuTreinoButton`); esta página só
/// mostra a sessão `EM_ANDAMENTO`, se houver.
export default async function SessaoIndividualPage() {
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
  const inProgress = await getInProgressSessionForStudent({ tenantId: ctx.tenantId, studentId: student.id });

  if (!inProgress) {
    return (
      <AppShell title="Sessão de treino" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
        <Card title="Nenhuma sessão em andamento">
          <p className={styles.empty}>
            Escolha um treino em <Link href="/painel/meus-treinos">Meus treinos</Link> e toque em &quot;Começar treino&quot;.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Sessão de treino" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Card title={inProgress.workout.name}>
        <SessaoExecucaoIndividual
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
