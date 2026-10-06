import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { parseLoadKg } from "@/shared/lib/load";
import { reviseStudentCopy } from "@/modules/library/studentCopy";
import { WorkoutError } from "@/modules/workouts/workouts";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Sugestão de progressão (EPIC-30): nas duas últimas vezes em que fez o
/// exercício, a pessoa completou todas as séries e repetições com a mesma
/// carga e não marcou o treino como pesado (esforço ≤ 3). Sugere subir
/// 2,5 kg; aceitar grava a nova carga no próprio item do treino.
export interface ProgressionSuggestion {
  workoutId: string;
  itemId: string;
  workoutName: string;
  exerciseName: string;
  fromKg: number;
  toKg: number;
  reps: number;
}

const STEP_KG = 2.5;
const MAX_EFFORT = 3;

export async function suggestProgressions(input: { tenantId: string; studentId: string; limit?: number }, client: PrismaClient = prisma): Promise<ProgressionSuggestion[]> {
  const sessions = await client.workoutSession.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "CONCLUIDA" },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      perceivedEffort: true,
      setResults: {
        select: {
          workoutExerciseId: true,
          performedExerciseId: true,
          reps: true,
          loadGrams: true,
          workoutExercise: { select: { id: true, workoutId: true, sets: true, reps: true, load: true, intensity: true, exercise: { select: { name: true } }, workout: { select: { name: true, status: true, trainingPlan: { select: { isSnapshot: true } } } } } },
        },
      },
    },
  });

  // Por item: as duas sessões mais recentes em que apareceu.
  const byItem = new Map<string, { item: (typeof sessions)[number]["setResults"][number]["workoutExercise"]; runs: { effort: number | null; sets: { reps: number | null; loadGrams: number | null }[] }[] }>();
  for (const session of sessions) {
    const grouped = new Map<string, { reps: number | null; loadGrams: number | null }[]>();
    for (const result of session.setResults) {
      // Séries feitas com outro exercício (aparelho ocupado) não contam para a progressão do prescrito.
      if (result.performedExerciseId) continue;
      const list = grouped.get(result.workoutExerciseId) ?? [];
      list.push({ reps: result.reps, loadGrams: result.loadGrams });
      grouped.set(result.workoutExerciseId, list);
      if (!byItem.has(result.workoutExerciseId)) byItem.set(result.workoutExerciseId, { item: result.workoutExercise, runs: [] });
    }
    for (const [itemId, sets] of grouped) {
      const entry = byItem.get(itemId)!;
      if (entry.runs.length < 2) entry.runs.push({ effort: session.perceivedEffort, sets });
    }
  }

  const suggestions: ProgressionSuggestion[] = [];
  for (const { item, runs } of byItem.values()) {
    if (runs.length < 2 || item.intensity || !item.reps) continue;
    if (item.workout.status !== "ATIVO" || item.workout.trainingPlan.isSnapshot) continue;
    const loads = runs.flatMap((run) => run.sets.map((set) => set.loadGrams ?? 0));
    const load = loads[0] ?? 0;
    if (load <= 0 || loads.some((value) => value !== load)) continue;
    const complete = runs.every((run) => run.sets.length >= (item.sets ?? 1) && run.sets.every((set) => (set.reps ?? 0) >= item.reps!) && (run.effort === null || run.effort <= MAX_EFFORT));
    if (!complete) continue;
    const fromKg = load / 1000;
    const prescribed = parseLoadKg(item.load);
    if (prescribed !== null && prescribed > fromKg) continue;
    suggestions.push({ workoutId: item.workoutId, itemId: item.id, workoutName: item.workout.name, exerciseName: item.exercise.name, fromKg, toKg: fromKg + STEP_KG, reps: item.reps });
  }
  return suggestions.slice(0, input.limit ?? 2);
}

/// Progressão para o personal (EPIC-44): a mesma regra, para os alunos.
/// O programa do aluno é uma cópia com versões (ADR-016) — cada ajuste
/// gera itens novos —, então o histórico é lido por exercício e a
/// sugestão aponta para o item da versão ativa. Aprovar gera uma nova
/// versão da cópia com a carga nova (dá para desfazer).
export interface CoachProgressionSuggestion extends ProgressionSuggestion {
  studentId: string;
  studentName: string;
}

const HISTORY_DAYS = 60;

export async function suggestCoachProgressions(
  input: { tenantId: string; studentId?: string; now?: Date },
  client: PrismaClient = prisma
): Promise<CoachProgressionSuggestion[]> {
  const now = input.now ?? new Date();
  const assignments = await client.planAssignment.findMany({
    where: { tenantId: input.tenantId, active: true, student: { status: "ATIVO" }, ...(input.studentId ? { studentId: input.studentId } : {}) },
    select: {
      studentId: true,
      student: { select: { displayName: true } },
      trainingPlan: {
        select: {
          workouts: {
            where: { status: "ATIVO" },
            orderBy: { position: "asc" },
            select: { id: true, name: true, workoutExercises: { orderBy: { position: "asc" }, select: { id: true, exerciseId: true, sets: true, reps: true, load: true, intensity: true, exercise: { select: { name: true } } } } },
          },
        },
      },
    },
  });
  if (assignments.length === 0) return [];

  const sessions = await client.workoutSession.findMany({
    where: { tenantId: input.tenantId, status: "CONCLUIDA", studentId: { in: assignments.map((row) => row.studentId) }, startedAt: { gte: new Date(now.getTime() - HISTORY_DAYS * 86_400_000) } },
    orderBy: { startedAt: "desc" },
    select: { studentId: true, perceivedEffort: true, setResults: { select: { performedExerciseId: true, reps: true, loadGrams: true, workoutExercise: { select: { exerciseId: true } } } } },
  });

  const suggestions: CoachProgressionSuggestion[] = [];
  for (const assignment of assignments) {
    // Por exercício: as duas sessões mais recentes em que apareceu.
    const runs = new Map<string, { effort: number | null; sets: { reps: number | null; loadGrams: number | null }[] }[]>();
    for (const session of sessions.filter((row) => row.studentId === assignment.studentId)) {
      const grouped = new Map<string, { reps: number | null; loadGrams: number | null }[]>();
      for (const result of session.setResults) {
        if (result.performedExerciseId) continue;
        const list = grouped.get(result.workoutExercise.exerciseId) ?? [];
        list.push({ reps: result.reps, loadGrams: result.loadGrams });
        grouped.set(result.workoutExercise.exerciseId, list);
      }
      for (const [exerciseId, sets] of grouped) {
        const list = runs.get(exerciseId) ?? [];
        if (list.length < 2) list.push({ effort: session.perceivedEffort, sets });
        runs.set(exerciseId, list);
      }
    }
    const seen = new Set<string>();
    for (const workout of assignment.trainingPlan.workouts) {
      for (const item of workout.workoutExercises) {
        if (seen.has(item.exerciseId) || item.intensity || !item.reps) continue;
        seen.add(item.exerciseId);
        const last = runs.get(item.exerciseId) ?? [];
        if (last.length < 2) continue;
        const loads = last.flatMap((run) => run.sets.map((set) => set.loadGrams ?? 0));
        const load = loads[0] ?? 0;
        if (load <= 0 || loads.some((value) => value !== load)) continue;
        const complete = last.every((run) => run.sets.length >= (item.sets ?? 1) && run.sets.every((set) => (set.reps ?? 0) >= item.reps!) && (run.effort === null || run.effort <= MAX_EFFORT));
        if (!complete) continue;
        const fromKg = load / 1000;
        const prescribed = parseLoadKg(item.load);
        if (prescribed !== null && prescribed > fromKg) continue;
        suggestions.push({ studentId: assignment.studentId, studentName: assignment.student.displayName, workoutId: workout.id, itemId: item.id, workoutName: workout.name, exerciseName: item.exercise.name, fromKg, toKg: fromKg + STEP_KG, reps: item.reps });
      }
    }
  }
  return suggestions.sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR") || a.exerciseName.localeCompare(b.exerciseName, "pt-BR"));
}

/// O personal aprova a sugestão: nova versão da cópia do aluno com a carga
/// nova (ADR-016; dá para desfazer) e um aviso no celular do aluno.
export async function approveCoachProgression(
  input: { tenantId: string; actorUserId: string; studentId: string; itemId: string; toKg: number },
  deps: { client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}
): Promise<{ previousPlanId: string; planId: string }> {
  const client = deps.client ?? prisma;
  const item = await client.workoutExercise.findFirst({
    where: { id: input.itemId, tenantId: input.tenantId, workout: { trainingPlan: { planAssignments: { some: { studentId: input.studentId, active: true } } } } },
    select: { exercise: { select: { name: true } } },
  });
  if (!item) throw new WorkoutError("NAO_ENCONTRADO", "Exercício não encontrado no programa do aluno.");
  const result = await reviseStudentCopy({ tenantId: input.tenantId, actorUserId: input.actorUserId, studentId: input.studentId, edit: { kind: "update", itemId: input.itemId, loadKg: input.toKg } }, client);
  try {
    const student = await client.student.findUniqueOrThrow({ where: { id: input.studentId }, select: { userId: true, tenant: { select: { owner: { select: { name: true } } } } } });
    if (student.userId) {
      const coach = student.tenant.owner.name.trim().split(/\s+/)[0];
      await sendToUser(student.userId, { title: `${coach} subiu sua carga`, body: `${item.exercise.name}: ${String(input.toKg).replace(".", ",")} kg a partir do próximo treino.`, url: "/painel/treino", tag: `progressao-${input.itemId}` }, { client, sender: deps.sender, config: deps.config });
    }
  } catch (error) {
    logEvent("error", "progressao_push_falhou", { studentId: input.studentId, ...describeError(error) });
  }
  return result;
}
