import "server-only";
import type { CardioIntensity, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getCatalogExerciseForTenant } from "@/modules/exercises/exercises";
import { getTenantPrescription, type Prescription, WorkoutError } from "@/modules/workouts/workouts";
import { CARDIO_INTENSITIES, CARDIO_MAX_SECONDS, CARDIO_MIN_SECONDS, DEFAULT_CARDIO, isCardioType } from "@/shared/lib/cardio";

/// Cópia do aluno (EPIC-28, ADR-016). Atribuir cria uma cópia imutável
/// (snapshot, ADR-005) do programa para o aluno. Ajustar a cópia nunca
/// altera essa versão: gera uma **nova versão** com a mudança e a
/// atribuição ativa passa a apontar para ela, mantendo a data de início.
/// As execuções já feitas continuam ligadas à versão em que aconteceram,
/// então o histórico nunca muda. Desfazer volta a atribuição para a versão
/// anterior.

export interface CopyItem {
  id: string;
  exerciseId: string;
  name: string;
  muscle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isCardio: boolean;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  intensity: CardioIntensity | null;
}

export interface StudentCopy {
  assignmentId: string;
  planId: string;
  planName: string;
  weeks: number | null;
  workouts: { id: string; name: string; days: string[]; items: CopyItem[] }[];
}

export type CopyEdit =
  | { kind: "swap"; itemId: string; exerciseId: string }
  | { kind: "update"; itemId: string; sets?: number; reps?: number; durationSeconds?: number; intensity?: CardioIntensity }
  | { kind: "addItem"; workoutId: string; exerciseId: string }
  | { kind: "removeItem"; itemId: string }
  | { kind: "addWorkout"; sourceWorkoutId: string };

const MAX_SETS = 20;
const MAX_REPS = 200;

export async function getStudentCopy(input: { tenantId: string; studentId: string }, client: PrismaClient = prisma): Promise<StudentCopy | null> {
  const assignment = await client.planAssignment.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, active: true },
    include: {
      trainingPlan: {
        include: {
          workouts: {
            where: { status: "ATIVO" },
            orderBy: { position: "asc" },
            include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: { select: { name: true, muscle: true, type: true, imageUrl: true, imageAlt: true } } } } },
          },
        },
      },
    },
  });
  if (!assignment) return null;
  const plan = assignment.trainingPlan;
  return {
    assignmentId: assignment.id,
    planId: plan.id,
    planName: plan.name,
    weeks: plan.durationWeeks,
    workouts: plan.workouts.map((workout) => ({
      id: workout.id,
      name: workout.name,
      days: workout.suggestedDays,
      items: workout.workoutExercises.map((item) => ({
        id: item.id,
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        muscle: item.exercise.muscle,
        imageUrl: item.exercise.imageUrl,
        imageAlt: item.exercise.imageAlt,
        isCardio: isCardioType(item.exercise.type),
        sets: item.sets,
        reps: item.reps,
        durationSeconds: item.durationSeconds,
        load: item.load,
        intensity: item.intensity,
      })),
    })),
  };
}

type ItemRow = Prisma.WorkoutExerciseGetPayload<object>;
type ItemData = Omit<Prisma.WorkoutExerciseUncheckedCreateInput, "tenantId" | "workoutId" | "position">;

function itemData(row: ItemRow): ItemData {
  return { exerciseId: row.exerciseId, sets: row.sets, reps: row.reps, durationSeconds: row.durationSeconds, load: row.load, restSeconds: row.restSeconds, notes: row.notes, intensity: row.intensity };
}

function defaultsFor(exerciseId: string, cardio: boolean, prescription: Prescription): ItemData {
  return cardio
    ? { exerciseId, durationSeconds: DEFAULT_CARDIO.durationSeconds, intensity: DEFAULT_CARDIO.intensity }
    : { exerciseId, sets: prescription.sets, reps: prescription.reps, restSeconds: prescription.restSeconds };
}

function intInRange(value: number | undefined, min: number, max: number, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) throw new WorkoutError("VALIDACAO", `${label} fora do intervalo permitido.`);
  return value;
}

/// Aplica um ajuste à cópia do aluno, gerando uma nova versão. Retorna a
/// versão anterior (para Desfazer) e a nova.
export async function reviseStudentCopy(
  input: { tenantId: string; actorUserId: string; studentId: string; edit: CopyEdit },
  client: PrismaClient = prisma
): Promise<{ previousPlanId: string; planId: string }> {
  const assignment = await client.planAssignment.findFirst({ where: { tenantId: input.tenantId, studentId: input.studentId, active: true } });
  if (!assignment) throw new WorkoutError("NAO_ENCONTRADO", "O aluno não tem programa ativo.");
  const plan = await client.trainingPlan.findFirstOrThrow({ where: { id: assignment.trainingPlanId, tenantId: input.tenantId } });
  const workouts = await client.workout.findMany({ where: { trainingPlanId: plan.id, tenantId: input.tenantId }, orderBy: { position: "asc" } });
  const items = await client.workoutExercise.findMany({ where: { tenantId: input.tenantId, workoutId: { in: workouts.map((workout) => workout.id) } }, orderBy: { position: "asc" } });
  const edit = input.edit;

  const findItem = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) throw new WorkoutError("NAO_ENCONTRADO", "Exercício não encontrado na cópia do aluno.");
    return item;
  };
  const visibleExercise = async (exerciseId: string) => {
    const exercise = await getCatalogExerciseForTenant({ tenantId: input.tenantId, exerciseId }, client);
    if (!exercise || exercise.status !== "ATIVO") throw new WorkoutError("EXERCICIO_INVALIDO", "Exercício não encontrado no catálogo.");
    return exercise;
  };

  let replace: { itemId: string; data: ItemData | null } | null = null;
  let append: { workoutId: string; data: ItemData } | null = null;
  let extraWorkout: { name: string; days: string[]; items: ItemData[] } | null = null;

  if (edit.kind === "swap") {
    const current = findItem(edit.itemId);
    const exercise = await visibleExercise(edit.exerciseId);
    const currentExercise = await client.exercise.findUniqueOrThrow({ where: { id: current.exerciseId }, select: { type: true } });
    const sameKind = isCardioType(exercise.type) === isCardioType(currentExercise.type);
    replace = { itemId: current.id, data: sameKind ? { ...itemData(current), exerciseId: exercise.id } : defaultsFor(exercise.id, isCardioType(exercise.type), await getTenantPrescription(input.tenantId, client)) };
  } else if (edit.kind === "update") {
    const current = findItem(edit.itemId);
    if (edit.intensity !== undefined && !CARDIO_INTENSITIES.includes(edit.intensity)) throw new WorkoutError("VALIDACAO", "Intensidade inválida.");
    replace = {
      itemId: current.id,
      data: {
        ...itemData(current),
        ...(edit.sets !== undefined ? { sets: intInRange(edit.sets, 1, MAX_SETS, "Séries") } : {}),
        ...(edit.reps !== undefined ? { reps: intInRange(edit.reps, 1, MAX_REPS, "Repetições") } : {}),
        ...(edit.durationSeconds !== undefined ? { durationSeconds: intInRange(edit.durationSeconds, current.intensity ? CARDIO_MIN_SECONDS : 1, CARDIO_MAX_SECONDS, "Tempo") } : {}),
        ...(edit.intensity !== undefined ? { intensity: edit.intensity } : {}),
      },
    };
  } else if (edit.kind === "removeItem") {
    findItem(edit.itemId);
    replace = { itemId: edit.itemId, data: null };
  } else if (edit.kind === "addItem") {
    if (!workouts.some((workout) => workout.id === edit.workoutId)) throw new WorkoutError("NAO_ENCONTRADO", "Treino não encontrado na cópia do aluno.");
    const exercise = await visibleExercise(edit.exerciseId);
    append = { workoutId: edit.workoutId, data: defaultsFor(exercise.id, isCardioType(exercise.type), await getTenantPrescription(input.tenantId, client)) };
  } else {
    const source = await client.workout.findFirst({ where: { id: edit.sourceWorkoutId, tenantId: input.tenantId, trainingPlan: { isSnapshot: false } }, include: { workoutExercises: { orderBy: { position: "asc" } } } });
    if (!source) throw new WorkoutError("NAO_ENCONTRADO", "Treino não encontrado na biblioteca.");
    extraWorkout = { name: source.name, days: source.suggestedDays, items: source.workoutExercises.map(itemData) };
  }

  return client.$transaction(async (tx) => {
    const next = await tx.trainingPlan.create({ data: { tenantId: input.tenantId, name: plan.name, durationWeeks: plan.durationWeeks } });
    const createItems = async (workoutId: string, rows: ItemData[]) => {
      for (const [position, data] of rows.entries()) {
        await tx.workoutExercise.create({ data: { ...data, tenantId: input.tenantId, workoutId, position } as Prisma.WorkoutExerciseUncheckedCreateInput });
      }
    };
    for (const workout of workouts) {
      const created = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: next.id, name: workout.name, position: workout.position, status: workout.status, suggestedDays: workout.suggestedDays } });
      const rows: ItemData[] = [];
      for (const item of items.filter((entry) => entry.workoutId === workout.id)) {
        if (replace && replace.itemId === item.id) {
          if (replace.data) rows.push(replace.data);
        } else {
          rows.push(itemData(item));
        }
      }
      if (append && append.workoutId === workout.id) rows.push(append.data);
      await createItems(created.id, rows);
    }
    if (extraWorkout) {
      const position = (workouts.at(-1)?.position ?? -1) + 1;
      const created = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: next.id, name: extraWorkout.name, position, suggestedDays: extraWorkout.days } });
      await createItems(created.id, extraWorkout.items);
    }
    await tx.trainingPlan.update({ where: { id: next.id }, data: { isSnapshot: true } });
    await tx.planAssignment.update({ where: { id: assignment.id }, data: { trainingPlanId: next.id } });
    await tx.auditEvent.create({ data: { tenantId: input.tenantId, actorUserId: input.actorUserId, action: "COPIA_AJUSTADA", entityType: "PlanAssignment", entityId: assignment.id } });
    return { previousPlanId: plan.id, planId: next.id };
  });
}

/// Desfazer: a atribuição ativa volta para uma versão anterior da cópia.
/// Só aceita uma cópia (snapshot) do mesmo espaço que nenhum outro aluno usa.
export async function restoreStudentCopy(
  input: { tenantId: string; actorUserId: string; studentId: string; planId: string },
  client: PrismaClient = prisma
): Promise<void> {
  const assignment = await client.planAssignment.findFirst({ where: { tenantId: input.tenantId, studentId: input.studentId, active: true } });
  if (!assignment) throw new WorkoutError("NAO_ENCONTRADO", "O aluno não tem programa ativo.");
  const plan = await client.trainingPlan.findFirst({ where: { id: input.planId, tenantId: input.tenantId, isSnapshot: true } });
  const usedByOther = await client.planAssignment.count({ where: { tenantId: input.tenantId, trainingPlanId: input.planId, studentId: { not: input.studentId } } });
  if (!plan || usedByOther > 0) throw new WorkoutError("NAO_ENCONTRADO", "Versão não encontrada.");
  await client.planAssignment.update({ where: { id: assignment.id }, data: { trainingPlanId: plan.id } });
}

/// Repetir o programa (EPIC-29, Início em fila): um novo ciclo da cópia
/// atual, com a mesma prescrição, começando hoje. O ciclo anterior é
/// encerrado como numa nova atribuição; o histórico continua nele.
export async function repeatStudentProgram(input: { tenantId: string; actorUserId: string; studentId: string }, client: PrismaClient = prisma): Promise<{ planId: string }> {
  const assignment = await client.planAssignment.findFirst({ where: { tenantId: input.tenantId, studentId: input.studentId, active: true }, include: { trainingPlan: true } });
  if (!assignment) throw new WorkoutError("NAO_ENCONTRADO", "O aluno não tem programa ativo.");
  const plan = assignment.trainingPlan;
  const workouts = await client.workout.findMany({ where: { trainingPlanId: plan.id, tenantId: input.tenantId, status: "ATIVO" }, orderBy: { position: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" } } } });
  const cycle = /, ciclo (\d+)$/.exec(plan.name);
  const name = cycle ? plan.name.replace(/, ciclo \d+$/, `, ciclo ${Number(cycle[1]) + 1}`) : `${plan.name}, ciclo 2`;
  return client.$transaction(async (tx) => {
    const now = new Date();
    await tx.planAssignment.update({ where: { id: assignment.id }, data: { active: false, endedAt: now } });
    const next = await tx.trainingPlan.create({ data: { tenantId: input.tenantId, name, durationWeeks: plan.durationWeeks } });
    for (const [position, workout] of workouts.entries()) {
      const created = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: next.id, name: workout.name, position, suggestedDays: workout.suggestedDays } });
      for (const item of workout.workoutExercises) {
        await tx.workoutExercise.create({ data: { ...itemData(item), tenantId: input.tenantId, workoutId: created.id, position: item.position } as Prisma.WorkoutExerciseUncheckedCreateInput });
      }
    }
    await tx.trainingPlan.update({ where: { id: next.id }, data: { isSnapshot: true } });
    const created = await tx.planAssignment.create({ data: { tenantId: input.tenantId, studentId: input.studentId, trainingPlanId: next.id, active: true, assignedAt: now } });
    await tx.auditEvent.create({ data: { tenantId: input.tenantId, actorUserId: input.actorUserId, action: "PLANO_ATRIBUIDO", entityType: "PlanAssignment", entityId: created.id } });
    return { planId: next.id };
  });
}
