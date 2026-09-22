import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { prisma } from "@/shared/db/prisma";

/// Importação do catálogo curado FITOS em PT-BR (IMP-EX-002) — um arquivo
/// estático versionado no repositório (`data/catalogo-exercicios-fitos-ptbr.csv`),
/// nunca uma API externa. Ao contrário da FIT-021 (API Ninjas), não existe
/// aqui nenhum risco de rede instável, paginação ou rate limit — um único
/// arquivo lido uma vez, do início ao fim — então este módulo
/// deliberadamente não reaproveita a trilha de execução do IMP-EX-001
/// (`catalogImportRun.ts`, com checkpoint/retomada/lock): essa complexidade
/// existe para um problema (importação lenta e falível de um fornecedor
/// externo) que este import não tem. A segurança contra reexecução
/// acidental vem só do upsert idempotente por `[origin, externalId]` abaixo
/// — chamar de novo com o mesmo arquivo nunca duplica nem perde dado.

export class CuratedCatalogRowError extends Error {
  constructor(
    public readonly row: number,
    message: string
  ) {
    super(`Linha ${row}: ${message}`);
    this.name = "CuratedCatalogRowError";
  }
}

/// Forma de uma linha do CSV exatamente como ele é publicado — todo campo
/// como string, mesma convenção de `ApiNinjasExerciseRaw`: nunca assumir
/// tipos que o parser de CSV não garante.
interface CuratedCatalogCsvRow {
  canonical_key: string;
  name: string;
  type: string;
  category: string;
  category_label: string;
  primary_muscle: string;
  primary_muscle_label: string;
  difficulty: string;
  equipments: string;
  instructions: string;
  safety_info: string;
  language: string;
  source: string;
  active: string;
}

export interface CuratedExerciseRecord {
  externalId: string;
  name: string;
  /// Preenchido com `category_label` (ex.: "Cabos e polias"), não `type`
  /// (só "strength"/"mobility" no arquivo de origem — pouco discriminante
  /// e em inglês). O mesmo slot de coluna (`Exercise.type`) que a FIT-021
  /// usa para o `type` bruto da API Ninjas já é, por convenção do próprio
  /// FIT-022 ("tipo/categoria"), tratado como um campo livre de
  /// tipo-ou-categoria — aqui a categoria em PT-BR é o valor mais útil para
  /// filtro e exibição direta ao personal.
  type: string;
  /// Preenchido com `primary_muscle_label` (ex.: "Bíceps"), não a chave
  /// interna (`primary_muscle`, "biceps") — o campo é exibido ao personal
  /// tal como está armazenado (`exercise.muscle`), então a versão legível
  /// em português é a correta aqui.
  muscle: string;
  /// `equipments` do CSV usa `|` como separador de múltiplos equipamentos
  /// (ex.: "barra W|banco inclinado") — normalizado para ", " porque o
  /// campo é exibido como texto corrido ao personal, nunca como lista.
  equipments: string | null;
  difficulty: string;
  instructions: string;
  safetyInfo: string;
  active: boolean;
}

function requireField(row: CuratedCatalogCsvRow, field: keyof CuratedCatalogCsvRow, rowNumber: number): string {
  const value = row[field];
  if (!value || value.trim().length === 0) {
    throw new CuratedCatalogRowError(rowNumber, `campo obrigatório "${field}" ausente ou vazio.`);
  }
  return value.trim();
}

/// Converte as linhas brutas do CSV (já parseadas) para o formato pronto
/// para persistir. Lança `CuratedCatalogRowError` (linha + motivo) na
/// primeira linha inválida — nunca importa parcialmente um arquivo com
/// dado ausente que devesse estar presente (`canonical_key`/`name`).
export function mapCuratedCatalogRows(rows: CuratedCatalogCsvRow[]): CuratedExerciseRecord[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based line numbering.
    const externalId = requireField(row, "canonical_key", rowNumber);
    const name = requireField(row, "name", rowNumber);
    const equipments = row.equipments?.trim() ? row.equipments.trim().split("|").join(", ") : null;

    return {
      externalId,
      name,
      type: row.category_label?.trim() || "",
      muscle: row.primary_muscle_label?.trim() || "",
      equipments,
      difficulty: row.difficulty?.trim() || "",
      instructions: row.instructions?.trim() || "",
      safetyInfo: row.safety_info?.trim() || "",
      active: row.active?.trim().toLowerCase() === "true",
    };
  });
}

export function parseCuratedCatalogCsv(csvContent: string): CuratedExerciseRecord[] {
  const rows: CuratedCatalogCsvRow[] = parse(csvContent, { columns: true, skip_empty_lines: true });
  return mapCuratedCatalogRows(rows);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/// Cria ou atualiza um único exercício do catálogo curado. Idempotente sob
/// concorrência, mesmo padrão de `upsertGlobalExercise` (FIT-021):
/// `externalId` é o próprio `canonical_key` do CSV — estável e legível por
/// natureza, nunca um hash calculado (diferente da API Ninjas, que não
/// fornece identificador estável).
async function upsertCuratedExercise(record: CuratedExerciseRecord, client: PrismaClient): Promise<"created" | "updated"> {
  const data = {
    name: record.name,
    type: record.type,
    muscle: record.muscle,
    equipments: record.equipments,
    difficulty: record.difficulty,
    instructions: record.instructions,
    safetyInfo: record.safetyInfo,
    status: record.active ? ("ATIVO" as const) : ("ARQUIVADO" as const),
  };

  try {
    await client.exercise.create({
      data: { ...data, tenantId: null, origin: "FITOS_CURATED", externalId: record.externalId },
    });
    return "created";
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      await client.exercise.update({
        where: { origin_externalId: { origin: "FITOS_CURATED", externalId: record.externalId } },
        data,
      });
      return "updated";
    }
    throw error;
  }
}

export interface ImportCuratedCatalogResult {
  total: number;
  created: number;
  updated: number;
}

/// Importa todos os registros para o catálogo global (`FITOS_CURATED`).
/// Chamado apenas por `scripts/import-catalogo-curado.ts` (execução manual)
/// — nunca por build, seed, deploy ou acesso a página, mesma regra já
/// seguida pela FIT-021.
export async function importCuratedCatalog(
  records: CuratedExerciseRecord[],
  client: PrismaClient = prisma
): Promise<ImportCuratedCatalogResult> {
  const result: ImportCuratedCatalogResult = { total: records.length, created: 0, updated: 0 };

  for (const record of records) {
    const outcome = await upsertCuratedExercise(record, client);
    if (outcome === "created") {
      result.created += 1;
    } else {
      result.updated += 1;
    }
  }

  return result;
}
