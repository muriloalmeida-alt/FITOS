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

function normalizeRequiredName(
  name: string,
  entityLabel: "o nome do modelo de treino" | "o nome do plano" = "o nome do modelo de treino"
): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new WorkoutError("VALIDACAO", `Informe ${entityLabel}.`);
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new WorkoutError("VALIDACAO", `${entityLabel[0]!.toUpperCase()}${entityLabel.slice(1)} deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
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

/// Único plano "rascunho" por tenant, identificado explicitamente por
/// `isDraftBucket: true` (nunca por heurística de `createdAt`: um personal
/// que cria um plano real, FIT-032, antes de qualquer modelo avulso não
/// pode fazer esse plano real ser confundido com o rascunho — um índice
/// único parcial em `(tenantId) WHERE isDraftBucket = true` garante no
/// máximo um por tenant). Cria um na primeira chamada. Nunca retorna/cria
/// um snapshot.
async function ensureDraftTrainingPlanForTenant(tenantId: string, client: PrismaClient): Promise<TrainingPlan> {
  const existing = await client.trainingPlan.findFirst({
    where: { tenantId, isDraftBucket: true },
  });
  if (existing) {
    return existing;
  }
  return client.trainingPlan.create({ data: { tenantId, name: DRAFT_TRAINING_PLAN_NAME, isDraftBucket: true } });
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

/// Clona um `Workout` (com todos os seus `WorkoutExercise`, na mesma
/// ordem) em uma linha nova dentro de `targetTrainingPlanId` — ids novos,
/// nenhuma FK entre a cópia e a origem (`REGRAS-DE-NEGOCIO.md`: "Duplicar
/// um modelo cria uma nova entidade sem vínculo de atualização
/// automática"). Motor compartilhado entre `duplicateWorkout` (FIT-031,
/// cópia explícita do personal) e o clone de atribuição da FIT-033
/// (ADR-005) — a única diferença entre os dois usos é o plano de destino
/// e se o nome recebe o sufixo de cópia.
///
/// Não valida se `targetTrainingPlanId` já é um snapshot (`isSnapshot`) —
/// se for, o próprio TRIGGER de imutabilidade (ADR-005) rejeita a
/// inserção; nenhuma função deste módulo expõe esse caminho ao personal.
async function cloneWorkoutWithItems(
  input: { tenantId: string; sourceWorkoutId: string; targetTrainingPlanId: string; nameOverride?: string },
  client: PrismaClient
): Promise<Workout> {
  const source = await client.workout.findFirstOrThrow({
    where: { id: input.sourceWorkoutId, tenantId: input.tenantId },
  });
  const items = await client.workoutExercise.findMany({
    where: { workoutId: source.id, tenantId: input.tenantId },
    orderBy: { position: "asc" },
  });

  const maxPosition = await client.workout.aggregate({
    where: { trainingPlanId: input.targetTrainingPlanId, tenantId: input.tenantId },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  return client.$transaction(async (tx) => {
    const clone = await tx.workout.create({
      data: {
        tenantId: input.tenantId,
        trainingPlanId: input.targetTrainingPlanId,
        name: input.nameOverride ?? source.name,
        position,
        suggestedDays: source.suggestedDays,
      },
    });

    for (const [index, item] of items.entries()) {
      await tx.workoutExercise.create({
        data: {
          tenantId: input.tenantId,
          workoutId: clone.id,
          exerciseId: item.exerciseId,
          position: index,
          sets: item.sets,
          reps: item.reps,
          durationSeconds: item.durationSeconds,
          load: item.load,
          restSeconds: item.restSeconds,
          notes: item.notes,
        },
      });
    }

    return clone;
  });
}

const COPY_NAME_SUFFIX = " (cópia)";

/// Duplica um modelo de treino do tenant — cópia independente no mesmo
/// plano do original, com o nome marcado como cópia até o personal
/// editar. Nunca afeta o original (FIT-031).
export async function duplicateWorkout(
  input: { tenantId: string; workoutId: string },
  client: PrismaClient = prisma
): Promise<Workout> {
  const source = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!source) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }

  return cloneWorkoutWithItems(
    {
      tenantId: input.tenantId,
      sourceWorkoutId: source.id,
      targetTrainingPlanId: source.trainingPlanId,
      nameOverride: `${source.name}${COPY_NAME_SUFFIX}`,
    },
    client
  );
}

/// Plano semanal (FIT-032). Agrupa um ou mais modelos de treino
/// (`Workout`). Só opera sobre planos com `isSnapshot: false` — um plano
/// snapshot (cópia imutável de atribuição, FIT-033/ADR-005) nunca é
/// alcançável por nenhuma função abaixo, mesma proteção em profundidade já
/// aplicada a `getWorkoutForTenant` na prática (o TRIGGER de imutabilidade
/// seria a rede de segurança se algo tentasse mesmo assim).

export interface CreateTrainingPlanInput {
  tenantId: string;
  name: string;
  durationWeeks?: number;
}

export async function createTrainingPlan(
  input: CreateTrainingPlanInput,
  client: PrismaClient = prisma
): Promise<TrainingPlan> {
  const name = normalizeRequiredName(input.name, "o nome do plano");
  const durationWeeks = normalizeOptionalPositiveInt(input.durationWeeks, "A vigência sugerida") ?? null;

  return client.trainingPlan.create({ data: { tenantId: input.tenantId, name, durationWeeks } });
}

/// Busca um plano **apenas se pertencer ao tenant informado e não for um
/// snapshot** — mesmo padrão de isolamento das demais funções deste
/// módulo. `null` tanto para "não existe" quanto para "é de outro tenant"
/// quanto para "é um snapshot", sem diferenciar a resposta.
export async function getTrainingPlanForTenant(
  input: { tenantId: string; trainingPlanId: string },
  client: PrismaClient = prisma
): Promise<TrainingPlan | null> {
  return client.trainingPlan.findFirst({
    where: { id: input.trainingPlanId, tenantId: input.tenantId, isSnapshot: false },
  });
}

/// Lista os planos ATIVOS (não-snapshot) do tenant, visíveis ao personal.
/// Nunca inclui o plano rascunho implícito (`isDraftBucket: true`) — é um
/// detalhe de implementação, não um programa que o personal decidiu
/// criar; não faria sentido aparecer em uma lista intitulada "Programas"
/// sem que o personal jamais tenha clicado em "Criar programa".
export async function listTrainingPlansForTenant(
  input: { tenantId: string },
  client: PrismaClient = prisma
): Promise<TrainingPlan[]> {
  return client.trainingPlan.findMany({
    where: { tenantId: input.tenantId, status: "ATIVO", isSnapshot: false, isDraftBucket: false },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export interface UpdateTrainingPlanInput {
  tenantId: string;
  trainingPlanId: string;
  name?: string;
  durationWeeks?: number | null;
}

export async function updateTrainingPlan(
  input: UpdateTrainingPlanInput,
  client: PrismaClient = prisma
): Promise<TrainingPlan> {
  const current = await getTrainingPlanForTenant({ tenantId: input.tenantId, trainingPlanId: input.trainingPlanId }, client);
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado.");
  }

  const data: { name?: string; durationWeeks?: number | null } = {};
  if (input.name !== undefined) {
    data.name = normalizeRequiredName(input.name, "o nome do plano");
  }
  if (input.durationWeeks !== undefined) {
    data.durationWeeks =
      input.durationWeeks === null ? null : normalizeOptionalPositiveInt(input.durationWeeks, "A vigência sugerida") ?? null;
  }

  if (Object.keys(data).length === 0) {
    return current;
  }

  return client.trainingPlan.update({ where: { id: input.trainingPlanId }, data });
}

export interface TrainingPlanLifecycleInput {
  tenantId: string;
  trainingPlanId: string;
}

/// Arquiva um plano do tenant. Idempotente. Nunca exclusão física — os
/// modelos agrupados permanecem intactos e continuam pertencendo ao
/// plano arquivado (arquivar o plano não move nem arquiva os modelos).
export async function archiveTrainingPlan(
  input: TrainingPlanLifecycleInput,
  client: PrismaClient = prisma
): Promise<TrainingPlan> {
  const current = await getTrainingPlanForTenant(
    { tenantId: input.tenantId, trainingPlanId: input.trainingPlanId },
    client
  );
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado.");
  }
  if (current.status === "ARQUIVADO") {
    return current;
  }
  return client.trainingPlan.update({ where: { id: input.trainingPlanId }, data: { status: "ARQUIVADO" } });
}

/// Reativa um plano do tenant. Idempotente pela mesma razão de
/// `archiveTrainingPlan`.
export async function reactivateTrainingPlan(
  input: TrainingPlanLifecycleInput,
  client: PrismaClient = prisma
): Promise<TrainingPlan> {
  const current = await getTrainingPlanForTenant(
    { tenantId: input.tenantId, trainingPlanId: input.trainingPlanId },
    client
  );
  if (!current) {
    throw new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado.");
  }
  if (current.status === "ATIVO") {
    return current;
  }
  return client.trainingPlan.update({ where: { id: input.trainingPlanId }, data: { status: "ATIVO" } });
}

/// Lista os modelos de treino ATIVOS de um plano específico, em ordem de
/// posição.
export async function listWorkoutsInPlan(
  input: { tenantId: string; trainingPlanId: string },
  client: PrismaClient = prisma
): Promise<Workout[]> {
  return client.workout.findMany({
    where: { tenantId: input.tenantId, trainingPlanId: input.trainingPlanId, status: "ATIVO" },
    orderBy: { position: "asc" },
  });
}

/// Lista os modelos de treino ATIVOS do tenant que **não** pertencem ao
/// plano informado — candidatos ao picker de "adicionar modelo ao plano".
export async function listWorkoutsAvailableForPlan(
  input: { tenantId: string; excludeTrainingPlanId: string },
  client: PrismaClient = prisma
): Promise<Workout[]> {
  return client.workout.findMany({
    where: { tenantId: input.tenantId, status: "ATIVO", trainingPlanId: { not: input.excludeTrainingPlanId } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

/// Move um modelo de treino para outro plano do mesmo tenant — reparenta
/// `trainingPlanId`, fecha o buraco de posição deixado no plano de
/// origem e o insere na última posição do plano de destino. Único
/// mecanismo de "adicionar"/"remover" modelo de um plano: como `Workout`
/// sempre pertence a exatamente um `TrainingPlan` (nunca uma relação
/// muitos-para-muitos, ver `docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md`),
/// "adicionar ao plano B" é, por construção, "mover do plano A para o
/// plano B".
export async function moveWorkoutToPlan(
  input: { tenantId: string; workoutId: string; targetTrainingPlanId: string },
  client: PrismaClient = prisma
): Promise<Workout> {
  const workout = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!workout) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado.");
  }
  const targetPlan = await getTrainingPlanForTenant(
    { tenantId: input.tenantId, trainingPlanId: input.targetTrainingPlanId },
    client
  );
  if (!targetPlan) {
    throw new WorkoutError("NAO_ENCONTRADO", "Plano de destino não encontrado.");
  }

  if (workout.trainingPlanId === targetPlan.id) {
    return workout;
  }

  const maxPosition = await client.workout.aggregate({
    where: { trainingPlanId: targetPlan.id, tenantId: input.tenantId },
    _max: { position: true },
  });
  const newPosition = (maxPosition._max.position ?? -1) + 1;

  return client.$transaction(async (tx) => {
    const moved = await tx.workout.update({
      where: { id: workout.id },
      data: { trainingPlanId: targetPlan.id, position: newPosition },
    });
    await tx.workout.updateMany({
      where: { trainingPlanId: workout.trainingPlanId, tenantId: input.tenantId, position: { gt: workout.position } },
      data: { position: { decrement: 1 } },
    });
    return moved;
  });
}

/// "Remover modelo do plano" — move-o de volta para o plano rascunho
/// implícito do tenant (nunca o exclui nem o arquiva; o modelo continua
/// existindo e utilizável, só deixa de estar agrupado neste plano).
/// Exige que o modelo pertença de fato a `trainingPlanId` no momento da
/// chamada — evita remover por engano um modelo que já não está mais
/// neste plano específico (`NAO_ENCONTRADO`, mesma resposta de qualquer
/// outra tentativa fora de contexto).
export async function removeWorkoutFromPlan(
  input: { tenantId: string; workoutId: string; trainingPlanId: string },
  client: PrismaClient = prisma
): Promise<Workout> {
  const workout = await getWorkoutForTenant({ tenantId: input.tenantId, workoutId: input.workoutId }, client);
  if (!workout || workout.trainingPlanId !== input.trainingPlanId) {
    throw new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado neste plano.");
  }

  const draftPlan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);
  return moveWorkoutToPlan({ tenantId: input.tenantId, workoutId: input.workoutId, targetTrainingPlanId: draftPlan.id }, client);
}

/// Reordena os modelos dentro de um plano conforme `orderedWorkoutIds` —
/// precisa ser exatamente o mesmo conjunto de modelos já pertencentes ao
/// plano (mesma validação de `reorderWorkoutExercises`).
export async function reorderWorkoutsInPlan(
  input: { tenantId: string; trainingPlanId: string; orderedWorkoutIds: string[] },
  client: PrismaClient = prisma
): Promise<void> {
  const current = await client.workout.findMany({
    where: { trainingPlanId: input.trainingPlanId, tenantId: input.tenantId },
    select: { id: true },
  });
  const currentIds = new Set(current.map((item) => item.id));
  const orderedUnique = new Set(input.orderedWorkoutIds);

  if (
    orderedUnique.size !== input.orderedWorkoutIds.length ||
    orderedUnique.size !== currentIds.size ||
    ![...orderedUnique].every((id) => currentIds.has(id))
  ) {
    throw new WorkoutError("VALIDACAO", "A nova ordem precisa conter exatamente os modelos já existentes no plano.");
  }

  await client.$transaction(
    input.orderedWorkoutIds.map((id, position) => client.workout.update({ where: { id }, data: { position } }))
  );
}
