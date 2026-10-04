import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getActivePlanAssignmentForStudent, getWeeklyRhythmForStudent, listEndedPlanAssignmentsForStudent } from "@/modules/workouts/workouts";
import { WEEKDAYS, mondayFirstIndex } from "@/shared/lib/weekdays";

/// Início do Aluno (FIT-151, A1 do protótipo): tudo o que a tela precisa,
/// já resolvido no servidor e serializável. Seis estados no total: os
/// quatro daqui (treino do dia, em andamento, descanso, sem programa) e os
/// dois sem vínculo/inativo, decididos antes em `/painel`.

export type StudentHomeHero =
  | { kind: "today"; workoutName: string; exercises: number; estimatedMinutes: number }
  | { kind: "progress"; workoutName: string; done: number; total: number; minutesAgo: number }
  | { kind: "rest"; next: { dayLabel: string; dayShort: string; workoutName: string } | null }
  | { kind: "noPlan"; endedPlanName: string | null };

export interface StudentHome {
  hero: StudentHomeHero;
  program: { name: string; week: number | null; weeks: number | null } | null;
  /// Segunda a domingo: previsto, feito, hoje.
  week: { planned: string[]; done: boolean[]; doneCount: number; target: number | null };
  upcoming: { dayLabel: string; dayShort: string; workoutName: string }[];
  lastAssessment: { dateIso: string; weightKg: number | null; bodyFatPercent: number | null } | null;
}

const DEFAULT_REST_SECONDS = 60;
const DEFAULT_WORK_SECONDS = 40;

/// Duração estimada: séries × (tempo de execução + descanso), arredondada
/// para 5 min.
export function estimateMinutes(items: { sets: number | null; durationSeconds: number | null; restSeconds: number | null }[]): number {
  const seconds = items.reduce((sum, item) => sum + (item.sets ?? 1) * ((item.durationSeconds ?? DEFAULT_WORK_SECONDS) + (item.restSeconds ?? DEFAULT_REST_SECONDS)), 0);
  return Math.max(5, Math.round(seconds / 300) * 5);
}

function dayLabel(offset: number, date: Date): string {
  if (offset === 1) return "Amanhã";
  return WEEKDAYS[mondayFirstIndex(date)]!.name;
}

export async function getStudentHome(input: { tenantId: string; studentId: string; now?: Date }, client: PrismaClient = prisma): Promise<StudentHome> {
  const now = input.now ?? new Date();
  const [assignment, session, rhythm, assessment] = await Promise.all([
    getActivePlanAssignmentForStudent(input, client),
    client.workoutSession.findFirst({
      where: { tenantId: input.tenantId, studentId: input.studentId, status: "EM_ANDAMENTO" },
      include: { workout: { select: { name: true, _count: { select: { workoutExercises: true } } } }, results: { select: { workoutExerciseId: true } } },
    }),
    getWeeklyRhythmForStudent(input, client),
    client.assessment.findFirst({ where: { tenantId: input.tenantId, studentId: input.studentId, deletedAt: null }, orderBy: { recordedAt: "desc" } }),
  ]);

  const workouts = assignment?.trainingPlan.workouts.filter((workout) => workout.status === "ATIVO") ?? [];
  const workoutOn = (date: Date) => workouts.find((workout) => workout.suggestedDays.includes(WEEKDAYS[mondayFirstIndex(date)]!.key)) ?? null;
  const upcoming: StudentHome["upcoming"] = [];
  for (let offset = 1; offset <= 7 && upcoming.length < 3; offset += 1) {
    const date = new Date(now.getTime() + offset * 86_400_000);
    const workout = workoutOn(date);
    if (workout) upcoming.push({ dayLabel: dayLabel(offset, date), dayShort: WEEKDAYS[mondayFirstIndex(date)]!.short, workoutName: workout.name });
  }

  let hero: StudentHomeHero;
  if (session) {
    hero = {
      kind: "progress",
      workoutName: session.workout.name,
      done: new Set(session.results.map((result) => result.workoutExerciseId)).size,
      total: session.workout._count.workoutExercises,
      minutesAgo: Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 60_000)),
    };
  } else if (!assignment) {
    const ended = await listEndedPlanAssignmentsForStudent(input, client);
    hero = { kind: "noPlan", endedPlanName: ended[0]?.trainingPlan.name ?? null };
  } else {
    const today = workoutOn(now);
    hero = today
      ? { kind: "today", workoutName: today.name, exercises: today.workoutExercises.length, estimatedMinutes: estimateMinutes(today.workoutExercises) }
      : { kind: "rest", next: upcoming[0] ?? null };
  }

  const weeks = assignment?.trainingPlan.durationWeeks ?? null;
  return {
    hero,
    program: assignment
      ? { name: assignment.trainingPlan.name, weeks, week: weeks ? Math.min(weeks, Math.floor((now.getTime() - assignment.assignedAt.getTime()) / (7 * 86_400_000)) + 1) : null }
      : null,
    week: { planned: [...new Set(workouts.flatMap((workout) => workout.suggestedDays))], done: rhythm.dayFlags, doneCount: rhythm.completedDays, target: rhythm.targetDays },
    upcoming,
    lastAssessment: assessment
      ? {
          dateIso: assessment.recordedAt.toISOString(),
          weightKg: assessment.weightGrams !== null ? assessment.weightGrams / 1000 : null,
          bodyFatPercent: assessment.bodyFatTenthPercent !== null ? assessment.bodyFatTenthPercent / 10 : null,
        }
      : null,
  };
}
