import "server-only";
import { Prisma, type Workout, type WorkoutExercise, type TrainingPlan, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getCatalogExerciseForTenant } from "@/modules/exercises/exercises";

/// Modelo de treino (FIT-030). `tenantId` nunca é um parâmetro
/// opcional/inferido — todo chamador já deve tê-lo derivado do contexto de
/// autorização da sessão (`requirePersonal`, FIT-011), mesmo padrão de
/// `exercises.ts`/`students.ts`.
///
/// Um `Workout` sempre pertence a exatamente um `TrainingPlan` (FK
/// obrigatória desde a FIT-007) — "reutilizável" é resolvido por
/// duplicação (FIT-031), nunca por uma relação muitos-para-muitos. Ver
/// `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md`.
///
/// Até a FIT-032 entregar a criação real de plano semanal, todo modelo
/// criado por este módulo é anexado a um plano "rascunho" implícito, único
/// por tenant, auto-provisionado por `ensureDraftTrainingPlanForTenant` —
/// mesmo tipo de bootstrapping já usado para o tenant do personal
/// (`ensureTenantForPersonal`, FIT-010). Não é um conceito novo exposto ao
/// personal; é só o "lugar" físico onde os modelos avulsos moram até
/// existir um builder de plano de verdade.

export class WorkoutError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "EXERCICIO_INVALIDO",
    message: string
  ) {
    super(message);
    this.name = "WorkoutError";
  }
}

const MAX_NAME_LENGTH = 120;
const MAX_LOAD_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;
const DRAFT_TRAINING_PLAN_NAME = "Meus modelos";

function normalizeRequiredName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new WorkoutError("VALIDACAO", "Informe o nome do modelo de treino.");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new WorkoutError("VALIDACAO", `O nome do modelo deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }
  return trimmed;
}

function normalizeOptionalPositiveInt(value: number | undefined, label: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new WorkoutError("VALIDACAO", `${label} deve ser um número inteiro maior que zero.`);
  }
  return value;
}

function normalizeOptionalText(value: string | undefined, label: string, maxLength: number): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new WorkoutError("VALIDACAO", `${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return trimmed;
}

/// Único plano "rascunho" por tenant (o primeiro `TrainingPlan` não-snapshot
/// criado) — cria um na primeira chamada. Nunca retorna/cria um snapshot.
async function ensureDraftTrainingPlanForTenant(tenantId: string, client: PrismaClient): Promise<TrainingPlan> {
  const existing = await client.trainingPlan.findFirst({
    where: { tenantId, isSnapshot: false },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return existing;
  }
  return client.trainingPlan.create({ data: { tenantId, name: DRAFT_TRAINING_PLAN_NAME } });
}

export interface CreateWorkoutInput {
  tenantId: string;
  name: string;
}

/// Cria um modelo de treino no plano rascunho do tenant. Sempre
/// `status: "ATIVO"` (default do schema); posição sequencial (maior
/// posição existente no mesmo plano + 1, começando em 0).
export async function createWorkout(input: CreateWorkoutInput, client: PrismaClient = prisma): Promise<Workout> {
  const name = normalizeRequiredName(input.name);
  const trainingPlan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);

  const maxPosition = await client.workout.aggregate({
    where: { trainingPlanId: trainingPlan.id, tenantId: input.tenantId },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  return client.workout.create({
    data: { tenantId: input.tenantId, trainingPlanId: trainingPlan.id, name, position },
  });
}

/// Busca um modelo de treino **apenas se pertencer ao tenant informado**.
/// Retorna `null` (não lança) quando não existe ou pertence a outro
/// tenant — o chamador decide tratar isso como 404, sem revelar se o `id`
/// existe em outro tenant (mesmo padrão de `getOwnExerciseForTenant`).
export async function getWorkoutForTenant(
  input: { tenantId: string; workoutId: string },
  client: PrismaClient = prisma
): Promise<Workout | null> {
  return client.workout.findFirst({ where: { id: input.workoutId, tenantId: input.tenantId } });
}

export interface ListWorkoutsInput {
  tenantId: string;
}

/// Lista os modelos de treino ATIVOS do tenant (qualquer plano não-snapshot
/// — na prática, hoje, só o plano rascunho; a FIT-032 poderá ter mais de
/// um). Modelo arquivado nunca aparece aqui.
export async function listWorkoutsForTenant(input: ListWorkoutsInput, client: PrismaClient = prisma): Promise<Workout[]> {
  return client.workout.findMany({
    where: { tenantId: input.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export interface UpdateWorkoutInput {
  tenantId: string;
  workoutId: string;
  name?: string;
  suggestedDays?: string[];
}

/// Edita um modelo de treino do tenant. `tenantId`/`trainingPlanId` nunca
/// fazem parte do payload aceito por esta função.
export async function updateWorkout(input: UpdateWorkoutInput, client: PrismaClient = prisma): Promise<Workout> {
  const current = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }

  const data: { name?: string; suggestedDays?: string[] } = {};
  if (input.name !== undefined) {
    data.name = normalizeRequiredName(input.name);
  }
  if (input.suggestedDays !== undefined) {
    data.suggestedDays = input.suggestedDays;
  }

  if (Object.keys(data).length === 0) {
    return current;
  }

  return client.workout.update({ where: { id: input.workoutId }, data });
}

export interface WorkoutLifecycleInput {
  tenantId: string;
  workoutId: string;
}

/// Arquiva um modelo de treino do tenant. Idempotente. Nunca exclusão
/// física.
export async function archiveWorkout(input: WorkoutLifecycleInput, client: PrismaClient = prisma): Promise<Workout> {
  const current = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }
  if (current.status === "ARQUIVADO") {
    return current;
  }
  return client.workout.update({ where: { id: input.workoutId }, data: { status: "ARQUIVADO" } });
}

/// Reativa um modelo de treino do tenant. Idempotente pela mesma razão de
/// `archiveWorkout`.
export async function reactivateWorkout(input: WorkoutLifecycleInput, client: PrismaClient = prisma): Promise<Workout> {
  const current = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }
  if (current.status === "ATIVO") {
    return current;
  }
  return client.workout.update({ where: { id: input.workoutId }, data: { status: "ATIVO" } });
}

export interface AddWorkoutExerciseInput {
  tenantId: string;
  workoutId: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  load?: string;
  restSeconds?: number;
  notes?: string;
}

/// Adiciona um exercício ao modelo, na próxima posição disponível. O
/// exercício precisa estar no catálogo visível ao tenant (global ou
/// próprio do tenant) — reaproveita `getCatalogExerciseForTenant` (FIT-023)
/// em vez de duplicar essa checagem; o TRIGGER `enforce_workout_exercise_tenant`
/// (FIT-007) é a segunda camada física da mesma regra.
export async function addWorkoutExercise(
  input: AddWorkoutExerciseInput,
  client: PrismaClient = prisma
): Promise<WorkoutExercise> {
  const workout = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!workout) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }

  const exercise = await getCatalogExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.exerciseId }, client);
  if (!exercise) {
    throw new WorkoutError("EXERCICIO_INVALIDO", "Exercício não encontrado no catálogo visível à sua conta.");
  }

  const sets = normalizeOptionalPositiveInt(input.sets, "Séries") ?? null;
  const reps = normalizeOptionalPositiveInt(input.reps, "Repetições") ?? null;
  const durationSeconds = normalizeOptionalPositiveInt(input.durationSeconds, "A duração") ?? null;
  const restSeconds = normalizeOptionalPositiveInt(input.restSeconds, "O descanso") ?? null;
  const load = normalizeOptionalText(input.load, "A carga", MAX_LOAD_LENGTH) ?? null;
  const notes = normalizeOptionalText(input.notes, "A observação", MAX_NOTES_LENGTH) ?? null;

  const maxPosition = await client.workoutExercise.aggregate({
    where: { workoutId: input.workoutId, tenantId: input.tenantId },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  return client.workoutExercise.create({
    data: {
      tenantId: input.tenantId,
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      position,
      sets,
      reps,
      durationSeconds,
      load,
      restSeconds,
      notes,
    },
  });
}

/// Lista os itens do modelo, em ordem de posição, com o exercício
/// referenciado já incluído (nome/músculo) — evita que a página precise de
/// uma segunda consulta por item.
export async function listWorkoutExercisesForWorkout(
  input: { tenantId: string; workoutId: string },
  client: PrismaClient = prisma
): Promise<(WorkoutExercise & { exercise: { name: string; muscle: string | null } })[]> {
  return client.workoutExercise.findMany({
    where: { workoutId: input.workoutId, tenantId: input.tenantId },
    orderBy: { position: "asc" },
    include: { exercise: { select: { name: true, muscle: true } } },
  });
}

/// Busca um item de treino **apenas se pertencer ao modelo e ao tenant
/// informados** — mesmo padrão de isolamento das demais funções deste
/// módulo.
export async function getWorkoutExerciseForTenant(
  input: { tenantId: string; workoutId: string; workoutExerciseId: string },
  client: PrismaClient = prisma
): Promise<WorkoutExercise | null> {
  return client.workoutExercise.findFirst({
    where: { id: input.workoutExerciseId, workoutId: input.workoutId, tenantId: input.tenantId },
  });
}

export interface UpdateWorkoutExerciseInput {
  tenantId: string;
  workoutId: string;
  workoutExerciseId: string;
  sets?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  load?: string;
  restSeconds?: number | null;
  notes?: string;
}

/// Edita os parâmetros de prescrição de um item. `undefined` mantém o
/// valor atual; `null` (nos campos numéricos) ou string vazia (nos campos
/// de texto) limpa o campo.
export async function updateWorkoutExercise(
  input: UpdateWorkoutExerciseInput,
  client: PrismaClient = prisma
): Promise<WorkoutExercise> {
  const current = await getWorkoutExerciseForTenant(
    { tenantId: input.tenantId, workoutId: input.workoutId, workoutExerciseId: input.workoutExerciseId },
    client
  );
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Item do modelo de treino não encontrado.");
  }

  const data: Prisma.WorkoutExerciseUpdateInput = {};
  const sets = normalizeOptionalPositiveInt(input.sets ?? undefined, "Séries");
  if (input.sets !== undefined) {
    data.sets = input.sets === null ? null : sets;
  }
  const reps = normalizeOptionalPositiveInt(input.reps ?? undefined, "Repetições");
  if (input.reps !== undefined) {
    data.reps = input.reps === null ? null : reps;
  }
  const durationSeconds = normalizeOptionalPositiveInt(input.durationSeconds ?? undefined, "A duração");
  if (input.durationSeconds !== undefined) {
    data.durationSeconds = input.durationSeconds === null ? null : durationSeconds;
  }
  const restSeconds = normalizeOptionalPositiveInt(input.restSeconds ?? undefined, "O descanso");
  if (input.restSeconds !== undefined) {
    data.restSeconds = input.restSeconds === null ? null : restSeconds;
  }
  const load = normalizeOptionalText(input.load, "A carga", MAX_LOAD_LENGTH);
  if (load !== undefined) {
    data.load = load;
  }
  const notes = normalizeOptionalText(input.notes, "A observação", MAX_NOTES_LENGTH);
  if (notes !== undefined) {
    data.notes = notes;
  }

  if (Object.keys(data).length === 0) {
    return current;
  }

  return client.workoutExercise.update({ where: { id: input.workoutExerciseId }, data });
}

/// Remove um item do modelo e fecha o buraco de posição deixado — os
/// itens seguintes recuam uma posição, mesma transação.
export async function removeWorkoutExercise(
  input: { tenantId: string; workoutId: string; workoutExerciseId: string },
  client: PrismaClient = prisma
): Promise<void> {
  const current = await getWorkoutExerciseForTenant(
    { tenantId: input.tenantId, workoutId: input.workoutId, workoutExerciseId: input.workoutExerciseId },
    client
  );
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Item do modelo de treino não encontrado.");
  }

  await client.$transaction([
    client.workoutExercise.delete({ where: { id: input.workoutExerciseId } }),
    client.workoutExercise.updateMany({
      where: { workoutId: input.workoutId, tenantId: input.tenantId, position: { gt: current.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
}

/// Reordena os itens do modelo conforme a ordem de `orderedIds` — precisa
/// ser exatamente o mesmo conjunto de ids já existente no modelo (rejeita
/// qualquer id ausente/extra/duplicado, sem tocar o banco).
export async function reorderWorkoutExercises(
  input: { tenantId: string; workoutId: string; orderedIds: string[] },
  client: PrismaClient = prisma
): Promise<void> {
  const current = await client.workoutExercise.findMany({
    where: { workoutId: input.workoutId, tenantId: input.tenantId },
    select: { id: true },
  });
  const currentIds = new Set(current.map((item) => item.id));
  const orderedUnique = new Set(input.orderedIds);

  if (
    orderedUnique.size !== input.orderedIds.length ||
    orderedUnique.size !== currentIds.size ||
    ![...orderedUnique].every((id) => currentIds.has(id))
  ) {
    throw new WorkoutError("VALIDACAO", "A nova ordem precisa conter exatamente os itens já existentes no modelo.");
  }

  await client.$transaction(
    input.orderedIds.map((id, position) => client.workoutExercise.update({ where: { id }, data: { position } }))
  );
}
