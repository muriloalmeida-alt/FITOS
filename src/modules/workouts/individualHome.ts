import "server-only";
import type { PrismaClient, WeeklyAvailability } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { WEEKDAYS, mondayFirstIndex } from "@/shared/lib/weekdays";
import { estimateMinutes } from "@/modules/students/studentHome";
import { suggestProgressions, type ProgressionSuggestion } from "@/modules/execution/progression";

/// Início do FitOS Livre (FIT-156, L1 do protótipo). BK-16: "Hoje para
/// você" é o treino com o dia de hoje nos dias sugeridos; sem nenhum, o
/// treino feito há mais tempo (rodízio). Semana contra a meta do perfil.

export interface IndividualWorkoutCard {
  id: string;
  name: string;
  exercises: number;
  estimatedMinutes: number;
  days: string[];
}

export interface IndividualHome {
  today: (IndividualWorkoutCard & { reason: "dia" | "rodizio" }) | null;
  inProgress: { workoutName: string; done: number; total: number; minutesAgo: number } | null;
  workouts: IndividualWorkoutCard[];
  week: { done: boolean[]; doneCount: number; target: number };
  monthSessions: number;
  activeGoals: number;
  /// EPIC-30: subir a carga onde já está fácil.
  progressions: ProgressionSuggestion[];
}

export const AVAILABILITY_TARGET: Record<WeeklyAvailability, number> = {
  UM_A_DOIS_DIAS: 2,
  TRES_A_QUATRO_DIAS: 4,
  CINCO_OU_MAIS_DIAS: 5,
};

function weekStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayFirstIndex(now));
  return start;
}

export async function getIndividualHome(input: { tenantId: string; userId: string; now?: Date }, client: PrismaClient = prisma): Promise<IndividualHome> {
  const now = input.now ?? new Date();
  const [workouts, profile, self] = await Promise.all([
    client.workout.findMany({
      where: { tenantId: input.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { workoutExercises: { select: { sets: true, durationSeconds: true, restSeconds: true } } },
    }),
    client.individualProfile.findUnique({ where: { tenantId: input.tenantId } }),
    client.student.findUnique({ where: { userId: input.userId } }),
  ]);

  const cards: IndividualWorkoutCard[] = workouts.map((workout) => ({
    id: workout.id,
    name: workout.name,
    exercises: workout.workoutExercises.length,
    estimatedMinutes: estimateMinutes(workout.workoutExercises),
    days: workout.suggestedDays,
  }));
  const target = profile ? AVAILABILITY_TARGET[profile.weeklyAvailability] : 3;

  if (!self || self.tenantId !== input.tenantId) {
    const todayKey = WEEKDAYS[mondayFirstIndex(now)]!.key;
    const byDay = cards.find((card) => card.exercises > 0 && card.days.includes(todayKey));
    const first = cards.find((card) => card.exercises > 0);
    return {
      today: byDay ? { ...byDay, reason: "dia" } : first ? { ...first, reason: "rodizio" } : null,
      inProgress: null,
      workouts: cards,
      week: { done: [false, false, false, false, false, false, false], doneCount: 0, target },
      monthSessions: 0,
      activeGoals: 0,
      progressions: [],
    };
  }

  const start = weekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [session, weekSessions, monthSessions, lastByWorkout, activeGoals, progressions] = await Promise.all([
    client.workoutSession.findFirst({
      where: { tenantId: input.tenantId, studentId: self.id, status: "EM_ANDAMENTO" },
      include: { workout: { select: { name: true, _count: { select: { workoutExercises: true } } } }, results: { select: { workoutExerciseId: true } } },
    }),
    client.workoutSession.findMany({ where: { tenantId: input.tenantId, studentId: self.id, status: "CONCLUIDA", startedAt: { gte: start } }, select: { startedAt: true } }),
    client.workoutSession.count({ where: { tenantId: input.tenantId, studentId: self.id, status: "CONCLUIDA", startedAt: { gte: monthStart } } }),
    client.workoutSession.groupBy({ by: ["workoutId"], where: { tenantId: input.tenantId, studentId: self.id, status: "CONCLUIDA" }, _max: { startedAt: true } }),
    client.goal.count({ where: { tenantId: input.tenantId, studentId: self.id, status: "EM_ANDAMENTO" } }),
    suggestProgressions({ tenantId: input.tenantId, studentId: self.id }, client),
  ]);

  const done = [false, false, false, false, false, false, false];
  for (const entry of weekSessions) done[mondayFirstIndex(entry.startedAt)] = true;

  const todayKey = WEEKDAYS[mondayFirstIndex(now)]!.key;
  const usable = cards.filter((card) => card.exercises > 0);
  const byDay = usable.find((card) => card.days.includes(todayKey));
  const lastDone = new Map(lastByWorkout.map((row) => [row.workoutId, row._max.startedAt?.getTime() ?? 0]));
  const rotation = [...usable].sort((a, b) => (lastDone.get(a.id) ?? 0) - (lastDone.get(b.id) ?? 0))[0];

  return {
    today: byDay ? { ...byDay, reason: "dia" } : rotation ? { ...rotation, reason: "rodizio" } : null,
    inProgress: session
      ? {
          workoutName: session.workout.name,
          done: new Set(session.results.map((result) => result.workoutExerciseId)).size,
          total: session.workout._count.workoutExercises,
          minutesAgo: Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 60_000)),
        }
      : null,
    workouts: cards,
    week: { done, doneCount: done.filter(Boolean).length, target },
    monthSessions,
    activeGoals,
    progressions,
  };
}
