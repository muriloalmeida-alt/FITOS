import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, ProgressBar, WeekStrip } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { getActivePlanAssignmentForStudent, getWeeklyRhythmForStudent, listEndedPlanAssignmentsForStudent } from "@/modules/workouts/workouts";
import { WEEKDAYS, mondayFirstIndex, weekStripFromDays } from "@/shared/lib/weekdays";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";
import { ProgramWorkouts } from "./ProgramWorkouts";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Seu programa — ${appName}`,
};

/// Seu programa (FIT-152, A2 do protótipo), só do aluno da sessão: nome,
/// quem prescreveu, semana X de Y e faixa da semana; treinos que abrem e
/// fecham, com "Hoje", exercícios com foto, prescrição e observação, e
/// "Começar este treino". Sempre o plano-snapshot da atribuição ativa.
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

  const [active, student, rhythm] = await Promise.all([
    getActivePlanAssignmentForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
    prisma.student.findUniqueOrThrow({ where: { id: ctx.studentId }, include: { tenant: { include: { owner: true } } } }),
    getWeeklyRhythmForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
  ]);
  const personalName = student.tenant.owner.name;

  if (!active) {
    const ended = await listEndedPlanAssignmentsForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });
    return (
      <AppShell eyebrow="Seu programa" title={ended[0] ? `${ended[0].trainingPlan.name} terminou` : "Programa a caminho"} navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
        <p className={styles.muted}>{personalName} já foi avisado e vai montar o próximo. Ele aparece aqui assim que estiver pronto.</p>
      </AppShell>
    );
  }

  const now = new Date();
  const todayKey = WEEKDAYS[mondayFirstIndex(now)]!.key;
  const plan = active.trainingPlan;
  const weeks = plan.durationWeeks;
  const week = weeks ? Math.min(weeks, Math.floor((now.getTime() - active.assignedAt.getTime()) / (7 * 86_400_000)) + 1) : null;
  const workouts = plan.workouts.filter((workout) => workout.status === "ATIVO");
  const planned = [...new Set(workouts.flatMap((workout) => workout.suggestedDays))];

  return (
    <AppShell eyebrow="Seu programa" title={plan.name} subtitle={`Prescrito por ${personalName}`} navItems={ALUNO_NAV_ITEMS} activeKey="treino" trailing={<LogoutButton />}>
      <section className={styles.summary} aria-label="Andamento do programa">
        {week && weeks ? (
          <div className={styles.progress}>
            <ProgressBar value={(100 * week) / weeks} label="Semanas do programa" valueText={`Semana ${week} de ${weeks}`} />
            <span>
              Semana {week} de {weeks}
            </span>
          </div>
        ) : null}
        <WeekStrip days={weekStripFromDays(planned, { done: rhythm.dayFlags, today: now })} label="Esta semana" />
      </section>

      {workouts.length === 0 ? (
        <p className={styles.muted}>Este programa ainda não tem treinos.</p>
      ) : (
        <ProgramWorkouts
          workouts={workouts.map((workout) => ({
            id: workout.id,
            name: workout.name,
            days: workout.suggestedDays,
            today: workout.suggestedDays.includes(todayKey),
            items: workout.workoutExercises.map((item) => ({
              id: item.id,
              name: item.exercise.name,
              muscle: item.exercise.muscle,
              imageUrl: item.exercise.imageUrl,
              imageAlt: item.exercise.imageAlt,
              sets: item.sets,
              reps: item.reps,
              durationSeconds: item.durationSeconds,
              load: item.load,
              restSeconds: item.restSeconds,
              notes: item.notes,
              intensity: item.intensity,
            })),
          }))}
        />
      )}
    </AppShell>
  );
}
