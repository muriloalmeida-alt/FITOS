import "server-only";
import { Prisma, type Exercise, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Gestão de exercícios próprios do tenant (FIT-022; FIT-142 estende a
/// criação também ao workspace individual do FitOS Livre). `tenantId`
/// nunca é um parâmetro opcional/inferido — todo chamador já deve tê-lo
/// derivado do contexto de autorização da sessão (`requirePersonal` ou
/// `requireSubscriber`, FIT-011) antes de chamar qualquer função deste
/// módulo, mesmo padrão de `students.ts`.
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

/// Catálogo unificado (FIT-023): exercícios globais ATIVOS (visíveis a
/// qualquer personal autenticado) + exercícios próprios ATIVOS do tenant
/// da sessão. Nunca consulta a API Ninjas — sempre e só o banco local, por
/// isso funciona durante indisponibilidade externa. Exercício arquivado
/// nunca aparece aqui (mesma regra de `listStudents` para aluno inativo).

export type CatalogExerciseSortOrder = "nome_asc";

export interface ListCatalogExercisesInput {
  tenantId: string;
  /// FIT-147: "biblioteca" = catálogo global; "meus" = próprios do tenant,
  /// **incluindo arquivados** (para poder reativá-los); padrão = ambos, só ativos.
  origin?: "todos" | "biblioteca" | "meus";
  search?: string;
  muscle?: string;
  type?: string;
  difficulty?: string;
  page?: number;
  pageSize?: number;
}

export interface ListCatalogExercisesResult {
  items: Exercise[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_CATALOG_PAGE_SIZE = 20;
const MAX_CATALOG_PAGE_SIZE = 100;

/// Condição "pertence ao catálogo visível deste tenant": global ativo, ou
/// próprio ativo do próprio tenant. Reaproveitada por `getCatalogExerciseForTenant`
/// abaixo com uma diferença deliberada: o detalhe também precisa mostrar um
/// exercício próprio ARQUIVADO (para o personal decidir reativar), então a
/// condição de status "ATIVO" só se aplica à listagem, nunca ao detalhe.
///
/// "Global" é sempre `tenantId: null` e `origin !== "PERSONAL"` — nunca um
/// enum específico como `"API_NINJAS"` (IMP-EX-002, `FITOS_CURATED`
/// adicionado como segunda fonte global sem exigir nenhuma mudança nesta
/// condição, exatamente por já estar escrita desta forma).
function visibleCatalogOriginCondition(tenantId: string): Prisma.ExerciseWhereInput {
  return {
    OR: [
      { origin: { not: "PERSONAL" }, tenantId: null },
      { origin: "PERSONAL", tenantId },
    ],
  };
}

export async function listCatalogExercises(
  input: ListCatalogExercisesInput,
  client: PrismaClient = prisma
): Promise<ListCatalogExercisesResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(MAX_CATALOG_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_CATALOG_PAGE_SIZE));
  const search = input.search?.trim();

  const originCondition: Prisma.ExerciseWhereInput =
    input.origin === "biblioteca"
      ? { status: "ATIVO", origin: { not: "PERSONAL" }, tenantId: null }
      : input.origin === "meus"
        ? { origin: "PERSONAL", tenantId: input.tenantId }
        : { status: "ATIVO", ...visibleCatalogOriginCondition(input.tenantId) };
  const where: Prisma.ExerciseWhereInput = {
    ...originCondition,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    ...(input.muscle?.trim() ? { muscle: { contains: input.muscle.trim(), mode: "insensitive" as const } } : {}),
    ...(input.type?.trim() ? { type: { contains: input.type.trim(), mode: "insensitive" as const } } : {}),
    ...(input.difficulty?.trim() ? { difficulty: { contains: input.difficulty.trim(), mode: "insensitive" as const } } : {}),
  };

  // Ordenação estável: nome ascendente, com `id` como critério de
  // desempate — necessário para que a paginação nunca repita ou pule um
  // registro quando dois exercícios têm o mesmo nome (ex.: um global e um
  // próprio homônimos).
  const orderBy = [{ name: "asc" as const }, { id: "asc" as const }];

  const [items, total] = await Promise.all([
    client.exercise.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    client.exercise.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/// Lista completa (sem paginação) do catálogo visível ao tenant, para
/// seletores client-side com busca instantânea (montagem de treino,
/// `ExerciseAutocomplete`) — diferente de `listCatalogExercises`, que
/// pagina deliberadamente para a tela de navegação do catálogo
/// (`/painel/exercicios`). Usar a versão paginada aqui faria o seletor
/// esconder qualquer exercício fora da primeira página — bug real
/// encontrado após a IMP-EX-002 (208 exercícios curados sozinhos já
/// excedem o `MAX_CATALOG_PAGE_SIZE` de 100). `PICKER_HARD_LIMIT` é só uma
/// rede de segurança contra uma consulta sem tamanho definido, não um
/// valor esperado de ser alcançado no volume atual do catálogo.
const PICKER_HARD_LIMIT = 1000;

export interface CatalogExercisePickerItem {
  id: string;
  name: string;
  muscle: string | null;
  /// FIT-146: foto do movimento na biblioteca do editor de treino.
  imageUrl: string | null;
  imageAlt: string | null;
}

export async function listCatalogExercisesForPicker(
  input: { tenantId: string },
  client: PrismaClient = prisma
): Promise<CatalogExercisePickerItem[]> {
  const where: Prisma.ExerciseWhereInput = {
    status: "ATIVO",
    ...visibleCatalogOriginCondition(input.tenantId),
  };

  return client.exercise.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: PICKER_HARD_LIMIT,
    select: { id: true, name: true, muscle: true, imageUrl: true, imageAlt: true },
  });
}

/// Busca um exercício do catálogo visível ao tenant — global (qualquer
/// status; na prática sempre ATIVO, importação nunca cria um global
/// arquivado) ou próprio do tenant **em qualquer status**, incluindo
/// ARQUIVADO: o personal precisa conseguir abrir o detalhe de um exercício
/// próprio arquivado (para reativá-lo, por exemplo), mesmo que ele não
/// apareça na listagem padrão. Nunca um exercício próprio de outro tenant.
export async function getCatalogExerciseForTenant(
  input: { tenantId: string; exerciseId: string },
  client: PrismaClient = prisma
): Promise<Exercise | null> {
  return client.exercise.findFirst({
    where: { id: input.exerciseId, ...visibleCatalogOriginCondition(input.tenantId) },
  });
}

export interface SwapOption {
  id: string;
  name: string;
  muscle: string | null;
  type: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
}

/// Opções para trocar um exercício na cópia do aluno (EPIC-28): mesmo
/// grupo muscular; para aeróbico, outros aeróbicos. Catálogo visível ao
/// tenant, ativos, com foto primeiro.
export async function listSwapOptions(input: { tenantId: string; exerciseId: string; limit?: number }, client: PrismaClient = prisma): Promise<SwapOption[]> {
  const current = await getCatalogExerciseForTenant(input, client);
  if (!current) return [];
  const group: Prisma.ExerciseWhereInput = current.type === "Aeróbico" ? { type: "Aeróbico" } : current.muscle ? { muscle: current.muscle, NOT: { type: "Aeróbico" } } : { id: "__nenhum__" };
  const rows = await client.exercise.findMany({
    where: { status: "ATIVO", id: { not: current.id }, ...group, AND: [visibleCatalogOriginCondition(input.tenantId)] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, name: true, muscle: true, type: true, imageUrl: true, imageAlt: true },
  });
  return [...rows.filter((row) => row.imageUrl), ...rows.filter((row) => !row.imageUrl)].slice(0, input.limit ?? 12);
}

export interface CatalogFacets {
  muscles: string[];
  types: string[];
  difficulties: string[];
}

/// Opções dos filtros da biblioteca (FIT-147): valores distintos de
/// músculo, tipo e dificuldade no catálogo visível ao tenant, do mais
/// frequente ao menos frequente.
export async function listCatalogFacets(input: { tenantId: string }, client: PrismaClient = prisma): Promise<CatalogFacets> {
  const where: Prisma.ExerciseWhereInput = { status: "ATIVO", ...visibleCatalogOriginCondition(input.tenantId) };
  async function distinct(field: "muscle" | "type" | "difficulty"): Promise<string[]> {
    const rows = await client.exercise.findMany({ where: { ...where, [field]: { not: null } }, select: { [field]: true } });
    const counts = new Map<string, number>();
    for (const row of rows as unknown as Record<string, string | null>[]) {
      const value = row[field];
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  }
  const [muscles, types, difficulties] = await Promise.all([distinct("muscle"), distinct("type"), distinct("difficulty")]);
  return { muscles, types, difficulties };
}

/// BK-08 (FIT-147): "Criar uma versão minha" de um exercício da biblioteca
/// global. Cria um exercício próprio com os mesmos dados (inclusive a foto
/// pública, quando houver) e nome "<nome> (minha versão)", numerado se já
/// existir. Nunca altera o exercício global.
export async function copyCatalogExerciseAsOwn(
  input: { tenantId: string; actorUserId: string; exerciseId: string },
  client: PrismaClient = prisma
): Promise<Exercise> {
  const source = await getCatalogExerciseForTenant({ tenantId: input.tenantId, exerciseId: input.exerciseId }, client);
  if (!source || source.origin === "PERSONAL") {
    throw new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado.");
  }
  const base = `${source.name} (minha versão)`.slice(0, 120);
  for (let attempt = 1; attempt <= 20; attempt++) {
    const name = attempt === 1 ? base : `${base.slice(0, 114)} ${attempt}`;
    try {
      return await client.exercise.create({
        data: {
          tenantId: input.tenantId,
          origin: "PERSONAL",
          name,
          type: source.type,
          muscle: source.muscle,
          equipments: source.equipments,
          difficulty: source.difficulty,
          instructions: source.instructions,
          safetyInfo: source.safetyInfo,
          imageUrl: source.imageUrl,
          imageAlt: source.imageAlt,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }
  throw new ExerciseError("NOME_DUPLICADO_NO_TENANT", "Já existem muitas versões deste exercício na sua conta.");
}
