import "server-only";
import type { CardioIntensity, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { assignTrainingPlanToStudents, WorkoutError } from "@/modules/workouts/workouts";
import { estimateMinutes } from "@/modules/students/studentHome";
import { prescriptionLine } from "@/shared/lib/prescription";
import { isCardioType } from "@/shared/lib/cardio";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { ensureStarterLibrary } from "./starterLibrary";
import { reviseStudentCopy } from "./studentCopy";

/// Biblioteca do personal (EPIC-28): programas, treinos e aeróbicos do
/// espaço, prontos para aplicar a um ou mais alunos. Aplicar sempre gera
/// uma cópia por aluno; a biblioteca nunca muda por causa disso.

export interface LibraryEntry {
  id: string;
  name: string;
  meta: string;
  thumbnails: string[];
  cardio: boolean;
  /// Duração estimada (treinos e aeróbicos; `null` em programas).
  minutes: number | null;
  /// Conteúdo mostrado antes de aplicar.
  lines: { name: string; dose: string }[];
}

export interface Library {
  programs: LibraryEntry[];
  workouts: LibraryEntry[];
  cardio: LibraryEntry[];
}

type ItemWithExercise = {
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  intensity: CardioIntensity | null;
  exercise: { name: string; type: string | null; imageUrl: string | null };
};

const itemInclude = { workoutExercises: { orderBy: { position: "asc" as const }, include: { exercise: { select: { name: true, type: true, imageUrl: true } } } } };

function thumbs(items: ItemWithExercise[]): string[] {
  return items.map((item) => item.exercise.imageUrl).filter((url): url is string => Boolean(url)).slice(0, 3);
}

function daysLabel(days: string[]): string {
  return WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.short.toLowerCase()).join(" e ");
}

function workoutDose(items: ItemWithExercise[], days: string[] = []): string {
  const cardioOnly = items.length > 0 && items.every((item) => isCardioType(item.exercise.type));
  const amount = cardioOnly ? `${Math.round(items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) / 60)} min` : `${items.length} ${items.length === 1 ? "exercício" : "exercícios"}`;
  return [daysLabel(days), amount].filter(Boolean).join(" · ");
}

export async function getLibrary(input: { tenantId: string }, client: PrismaClient = prisma): Promise<Library> {
  await ensureStarterLibrary(input.tenantId, client);
  const [plans, loose] = await Promise.all([
    client.trainingPlan.findMany({
      where: { tenantId: input.tenantId, isSnapshot: false, isDraftBucket: false, status: "ATIVO" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { workouts: { where: { status: "ATIVO" }, orderBy: { position: "asc" }, include: itemInclude } },
    }),
    client.workout.findMany({
      where: { tenantId: input.tenantId, status: "ATIVO", trainingPlan: { isDraftBucket: true } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: itemInclude,
    }),
  ]);

  const programs: LibraryEntry[] = plans.map((plan) => {
    const all = plan.workouts.flatMap((workout) => workout.workoutExercises);
    const cardioWorkouts = plan.workouts.filter((workout) => workout.workoutExercises.length > 0 && workout.workoutExercises.every((item) => isCardioType(item.exercise.type))).length;
    const strength = plan.workouts.length - cardioWorkouts;
    const parts = [`${strength} ${strength === 1 ? "treino" : "treinos"}`];
    if (cardioWorkouts > 0) parts[0] += ` + ${cardioWorkouts} ${cardioWorkouts === 1 ? "aeróbico" : "aeróbicos"}`;
    if (plan.durationWeeks) parts.push(`${plan.durationWeeks} semanas`);
    return {
      id: plan.id,
      name: plan.name,
      meta: parts.join(" · "),
      thumbnails: thumbs(all),
      cardio: false,
      minutes: null,
      lines: plan.workouts.map((workout) => ({ name: workout.name, dose: workoutDose(workout.workoutExercises, workout.suggestedDays) })),
    };
  });

  const toEntry = (workout: (typeof loose)[number]): LibraryEntry => {
    const items = workout.workoutExercises;
    const cardio = items.length > 0 && items.every((item) => isCardioType(item.exercise.type));
    return {
      id: workout.id,
      name: workout.name,
      meta: cardio
        ? items.length === 1
          ? prescriptionLine(items[0]!)
          : `${Math.round(items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) / 60)} min · ${items.length} etapas`
        : `${items.length} ${items.length === 1 ? "exercício" : "exercícios"} · cerca de ${estimateMinutes(items)} min`,
      thumbnails: thumbs(items),
      cardio,
      minutes: estimateMinutes(items),
      lines: items.map((item) => ({ name: item.exercise.name, dose: prescriptionLine(item) })),
    };
  };
  const entries = loose.map(toEntry);
  return { programs, workouts: entries.filter((entry) => !entry.cardio), cardio: entries.filter((entry) => entry.cardio) };
}

/// Aplica um item da biblioteca a vários alunos. Programa: substitui o
/// programa do aluno por uma cópia. Treino ou aeróbico: entra como mais um
/// treino na cópia atual do aluno; sem programa ativo, vira um programa
/// só com ele.
export async function applyLibraryItem(
  input: { tenantId: string; actorUserId: string; kind: "programa" | "treino"; id: string; studentIds: string[] },
  client: PrismaClient = prisma
): Promise<{ applied: number }> {
  const studentIds = [...new Set(input.studentIds)];
  if (studentIds.length === 0) throw new WorkoutError("VALIDACAO", "Escolha ao menos um aluno.");
  if (input.kind === "programa") {
    const assignments = await assignTrainingPlanToStudents({ tenantId: input.tenantId, actorUserId: input.actorUserId, trainingPlanId: input.id, studentIds }, client);
    return { applied: assignments.length };
  }

  const workout = await client.workout.findFirst({ where: { id: input.id, tenantId: input.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } } });
  if (!workout) throw new WorkoutError("NAO_ENCONTRADO", "Treino não encontrado na biblioteca.");
  const students = await client.student.findMany({ where: { tenantId: input.tenantId, id: { in: studentIds } }, select: { id: true, status: true } });
  if (students.length !== studentIds.length) throw new WorkoutError("NAO_ENCONTRADO", "Aluno não encontrado.");
  if (students.some((student) => student.status !== "ATIVO")) throw new WorkoutError("ESTADO_INVALIDO", "Não é possível aplicar a um aluno inativo ou com vínculo encerrado.");

  for (const studentId of studentIds) {
    const active = await client.planAssignment.findFirst({ where: { tenantId: input.tenantId, studentId, active: true }, select: { id: true } });
    if (active) {
      await reviseStudentCopy({ tenantId: input.tenantId, actorUserId: input.actorUserId, studentId, edit: { kind: "addWorkout", sourceWorkoutId: workout.id } }, client);
      continue;
    }
    // Sem programa: um programa novo, só com este treino, atribuído como de costume.
    const holder = await client.trainingPlan.create({ data: { tenantId: input.tenantId, name: workout.name, status: "ARQUIVADO" } });
    await client.$transaction(async (tx) => {
      const clone = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: holder.id, name: workout.name, position: 0, suggestedDays: workout.suggestedDays } });
      const items = await tx.workoutExercise.findMany({ where: { workoutId: workout.id, tenantId: input.tenantId }, orderBy: { position: "asc" } });
      for (const item of items) {
        await tx.workoutExercise.create({
          data: { tenantId: input.tenantId, workoutId: clone.id, exerciseId: item.exerciseId, position: item.position, sets: item.sets, reps: item.reps, durationSeconds: item.durationSeconds, load: item.load, restSeconds: item.restSeconds, notes: item.notes, intensity: item.intensity },
        });
      }
    });
    await assignTrainingPlanToStudents({ tenantId: input.tenantId, actorUserId: input.actorUserId, trainingPlanId: holder.id, studentIds: [studentId] }, client);
    // O aluno ficou com a própria cópia; o programa provisório sai.
    await client.trainingPlan.delete({ where: { id: holder.id } });
  }
  return { applied: studentIds.length };
}
