import "server-only";
import { Prisma, type Exercise, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Gestão de exercícios próprios do personal (FIT-022). `tenantId` nunca é
/// um parâmetro opcional/inferido — todo chamador já deve tê-lo derivado
/// do contexto de autorização da sessão (`requirePersonal`, FIT-011) antes
/// de chamar qualquer função deste módulo, mesmo padrão de `students.ts`.
///
/// Exercício próprio nunca muda de tenant nem se torna global por aqui:
/// nenhuma função deste módulo aceita `tenantId`/`origin` como campo
/// editável — `createOwnExercise` sempre grava `origin: "PERSONAL"` com o
/// `tenantId` da sessão, e `updateOwnExercise`/`archiveExercise`/
/// `reactivateExercise` nunca tocam esses dois campos. A imutabilidade de
/// `tenantId` quando já referenciado por um `WorkoutExercise` é, além
/// disso, garantida fisicamente pelo trigger `enforce_exercise_tenant_immutability`
/// (FIT-007) — dupla proteção, não uma alternativa à outra.

export class ExerciseError extends Error {
  constructor(
    public readonly kind: "NOME_DUPLICADO_NO_TENANT" | "VALIDACAO" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "ExerciseError";
  }
}

const MAX_NAME_LENGTH = 120;
const MAX_SHORT_FIELD_LENGTH = 80;
const MAX_INSTRUCTIONS_LENGTH = 2000;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeRequiredName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ExerciseError("VALIDACAO", "Informe o nome do exercício.");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new ExerciseError("VALIDACAO", `O nome do exercício deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }
  return trimmed;
}

/// Normaliza um campo curto opcional (tipo/categoria, músculo, equipamento):
/// `undefined` é "não informado" (mantém o valor atual em updates); string
/// vazia após trim é tratada como "limpar o campo" (`null`); caso
/// contrário, valida o tamanho e preserva o texto.
function normalizeOptionalShortField(value: string | undefined, label: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_SHORT_FIELD_LENGTH) {
    throw new ExerciseError("VALIDACAO", `${label} deve ter no máximo ${MAX_SHORT_FIELD_LENGTH} caracteres.`);
  }
  return trimmed;
}

function normalizeOptionalInstructions(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new ExerciseError("VALIDACAO", `As instruções devem ter no máximo ${MAX_INSTRUCTIONS_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface CreateOwnExerciseInput {
  tenantId: string;
  actorUserId: string;
  name: string;
  type?: string;
  muscle?: string;
  equipments?: string;
  instructions?: string;
}

/// Cadastra um exercício próprio do tenant. Sempre `origin: "PERSONAL"`,
/// `status: "ATIVO"` (default do schema), `externalId: null` — nunca um
/// exercício importado da API Ninjas passa por aqui. Sem evento de
/// auditoria na criação (mesmo padrão de `createStudent`, FIT-013): o
/// próprio registro e seu `createdAt` já são o rastro; auditoria aqui é
/// para ações que alteram um registro existente (edição, arquivamento,
/// reativação).
export async function createOwnExercise(input: CreateOwnExerciseInput, client: PrismaClient = prisma): Promise<Exercise> {
  const name = normalizeRequiredName(input.name);
  const type = normalizeOptionalShortField(input.type, "O tipo") ?? null;
  const muscle = normalizeOptionalShortField(input.muscle, "O músculo principal") ?? null;
  const equipments = normalizeOptionalShortField(input.equipments, "O equipamento") ?? null;
  const instructions = normalizeOptionalInstructions(input.instructions) ?? null;

  try {
    return await client.exercise.create({
      data: { tenantId: input.tenantId, origin: "PERSONAL", name, type, muscle, equipments, instructions },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ExerciseError("NOME_DUPLICADO_NO_TENANT", "Já existe um exercício com este nome na sua conta.");
    }
    throw error;
  }
}

/// Busca um exercício próprio **apenas se pertencer ao tenant informado e
/// tiver origem PERSONAL** — nunca um exercício global, mesmo que o `id`
/// exista. Retorna `null` (não lança) quando não existe ou pertence a
/// outro tenant/é global; o chamador decide tratar isso como 404, sem
/// revelar se o `id` existe em outro tenant ou no catálogo global (mesmo
/// padrão de `getStudentForTenant`, FIT-013/014).
export async function getOwnExerciseForTenant(
  input: { tenantId: string; exerciseId: string },
  client: PrismaClient = prisma
): Promise<Exercise | null> {
  return client.exercise.findFirst({ where: { id: input.exerciseId, tenantId: input.tenantId, origin: "PERSONAL" } });
}

export interface UpdateOwnExerciseInput {
  tenantId: string;
  actorUserId: string;
  exerciseId: string;
  name?: string;
  type?: string;
  muscle?: string;
  equipments?: string;
  instructions?: string;
}

/// Edita um exercício próprio do tenant. Campos não informados (`undefined`)
/// permanecem inalterados; string vazia limpa o campo (exceto `name`, que é
/// obrigatório sempre que informado). `tenantId`/`origin`/`status` nunca
/// fazem parte do payload aceito por esta função.
export async function updateOwnExercise(input: UpdateOwnExerciseInput, client: PrismaClient = prisma): Promise<Exercise> {
  const current = await getOwnExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.exerciseId }, client);
  if (!current) {
    throw new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado.");
  }

  const data: {
    name?: string;
    type?: string | null;
    muscle?: string | null;
    equipments?: string | null;
    instructions?: string | null;
  } = {};

  if (input.name !== undefined) {
    data.name = normalizeRequiredName(input.name);
  }
  const type = normalizeOptionalShortField(input.type, "O tipo");
  if (type !== undefined) {
    data.type = type;
  }
  const muscle = normalizeOptionalShortField(input.muscle, "O músculo principal");
  if (muscle !== undefined) {
    data.muscle = muscle;
  }
  const equipments = normalizeOptionalShortField(input.equipments, "O equipamento");
  if (equipments !== undefined) {
    data.equipments = equipments;
  }
  const instructions = normalizeOptionalInstructions(input.instructions);
  if (instructions !== undefined) {
    data.instructions = instructions;
  }

  if (Object.keys(data).length === 0) {
    return current;
  }

  try {
    const [, updated] = await client.$transaction([
      client.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: "EXERCICIO_EDITADO",
          entityType: "Exercise",
          entityId: input.exerciseId,
        },
      }),
      client.exercise.update({ where: { id: input.exerciseId }, data }),
    ]);
    return updated;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ExerciseError("NOME_DUPLICADO_NO_TENANT", "Já existe um exercício com este nome na sua conta.");
    }
    throw error;
  }
}

export interface ExerciseLifecycleInput {
  tenantId: string;
  actorUserId: string;
  exerciseId: string;
}

/// Arquiva um exercício próprio do tenant. Idempotente: chamar novamente
/// sobre um exercício já arquivado não é erro — apenas retorna sem novo
/// evento de auditoria (mesmo padrão de `inactivateStudent`, FIT-014).
/// Nunca exclusão física — preserva qualquer `WorkoutExercise` já
/// existente (fora do escopo desta Sprint, mas a coluna nunca é tocada).
export async function archiveExercise(input: ExerciseLifecycleInput, client: PrismaClient = prisma): Promise<Exercise> {
  const current = await getOwnExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.exerciseId }, client);
  if (!current) {
    throw new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado.");
  }
  if (current.status === "ARQUIVADO") {
    return current;
  }

  const [, updated] = await client.$transaction([
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "EXERCICIO_ARQUIVADO",
        entityType: "Exercise",
        entityId: input.exerciseId,
      },
    }),
    client.exercise.update({ where: { id: input.exerciseId }, data: { status: "ARQUIVADO" } }),
  ]);
  return updated;
}

/// Reativa um exercício próprio do tenant. Idempotente pela mesma razão de
/// `archiveExercise`.
export async function reactivateExercise(input: ExerciseLifecycleInput, client: PrismaClient = prisma): Promise<Exercise> {
  const current = await getOwnExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.exerciseId }, client);
  if (!current) {
    throw new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado.");
  }
  if (current.status === "ATIVO") {
    return current;
  }

  const [, updated] = await client.$transaction([
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "EXERCICIO_REATIVADO",
        entityType: "Exercise",
        entityId: input.exerciseId,
      },
    }),
    client.exercise.update({ where: { id: input.exerciseId }, data: { status: "ATIVO" } }),
  ]);
  return updated;
}
