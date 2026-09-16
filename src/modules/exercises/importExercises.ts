import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { searchExercises } from "@/integrations/api-ninjas";
import type { ExerciseDTO, SearchExercisesInput } from "@/integrations/api-ninjas";

/// Importação e persistência do catálogo global (FIT-021). Exercício
/// global tem `tenantId` nulo e é lido por qualquer personal autenticado —
/// nunca criado/alterado a partir de payload de cliente; só este módulo
/// (chamado pelo comando administrativo, `scripts/import-exercicios.ts`)
/// escreve `origin: API_NINJAS`.

export interface ImportExercisesResult {
  /// Total de itens devolvidos pela API Ninjas nas buscas que tiveram sucesso.
  received: number;
  /// Itens com nome válido (passaram pelo adapter sem erro).
  valid: number;
  /// Itens rejeitados por não terem nome válido. Na prática, quase sempre
  /// 0: `searchExercises` (FIT-020) já valida cada item antes de devolver
  /// a lista, e rejeita a busca inteira (contada em `failedSearches`, não
  /// aqui) se qualquer item vier sem nome. Este contador é uma segunda
  /// camada defensiva, para o caso de o invariante do DTO mudar no futuro
  /// — nunca removido só porque hoje é inatingível.
  rejected: number;
  created: number;
  updated: number;
  /// Buscas (elementos de `searchInputs`) que falharam por qualquer motivo
  /// (API Ninjas indisponível, erro de rede, ou resposta com item
  /// inválido) — registros já importados de buscas anteriores nesta mesma
  /// chamada são preservados; a importação continua com as demais.
  failedSearches: number;
}

/// Chave de deduplicação determinística: a Exercises API não retorna um
/// identificador estável, então o FitOS calcula um hash a partir dos
/// campos que identificam **qual exercício é** (nome, tipo, músculo e
/// equipamento — a variante física, ex.: "Push-up" com/sem equipamento),
/// normalizados (minúsculas, sem espaço nas pontas). Deliberadamente NÃO
/// inclui `difficulty`/`instructions`/`safetyInfo`: são atributos
/// descritivos do mesmo exercício que podem ser corrigidos/atualizados
/// pelo fornecedor sem que isso signifique um exercício diferente — se
/// entrassem na chave, uma correção de dificuldade criaria um duplicado em
/// vez de atualizar o registro existente. A mesma busca repetida — ou uma
/// busca diferente que devolva o mesmo exercício — produz sempre o mesmo
/// `externalId`, permitindo o upsert idempotente abaixo.
export function buildExternalId(dto: ExerciseDTO): string {
  const key = [dto.name, dto.type, dto.muscle, dto.equipments]
    .map((part) => (part ?? "").toLowerCase().trim())
    .join("|");
  return createHash("sha256").update(key).digest("hex");
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/// Cria ou atualiza um único exercício global. Idempotente e seguro sob
/// concorrência, mesmo padrão de `ensureTenantForPersonal` (FIT-010):
/// tenta criar; se já existir (constraint única `[origin, externalId]`
/// rejeitando a segunda tentativa concorrente), atualiza em vez de
/// duplicar ou lançar erro para quem só queria garantir que o exercício
/// está atualizado.
async function upsertGlobalExercise(dto: ExerciseDTO, client: PrismaClient): Promise<"created" | "updated"> {
  const externalId = buildExternalId(dto);
  const data = {
    name: dto.name,
    type: dto.type,
    muscle: dto.muscle,
    equipments: dto.equipments,
    difficulty: dto.difficulty,
    instructions: dto.instructions,
    safetyInfo: dto.safetyInfo,
  };

  try {
    await client.exercise.create({
      data: { ...data, tenantId: null, origin: "API_NINJAS", externalId },
    });
    return "created";
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      await client.exercise.update({
        where: { origin_externalId: { origin: "API_NINJAS", externalId } },
        data,
      });
      return "updated";
    }
    throw error;
  }
}

/// Executa uma ou mais buscas na API Ninjas e importa os resultados para o
/// catálogo global. Nunca chamada automaticamente (build/seed/deploy/
/// acesso à página) — apenas pelo comando administrativo manual. Uma busca
/// que falhar (API externa indisponível, erro de rede) não aborta as
/// demais nem desfaz o que já foi importado nesta mesma chamada —
/// resposta parcial ou vazia preserva os registros já existentes.
export async function importGlobalExercises(
  searchInputs: SearchExercisesInput[],
  client: PrismaClient = prisma,
  searchFn: typeof searchExercises = searchExercises
): Promise<ImportExercisesResult> {
  const result: ImportExercisesResult = { received: 0, valid: 0, rejected: 0, created: 0, updated: 0, failedSearches: 0 };

  for (const searchInput of searchInputs) {
    let dtos: ExerciseDTO[];
    try {
      dtos = await searchFn(searchInput, {});
    } catch {
      result.failedSearches += 1;
      continue;
    }

    result.received += dtos.length;
    for (const dto of dtos) {
      if (!dto.name) {
        result.rejected += 1;
        continue;
      }
      result.valid += 1;
      const outcome = await upsertGlobalExercise(dto, client);
      if (outcome === "created") {
        result.created += 1;
      } else {
        result.updated += 1;
      }
    }
  }

  return result;
}
