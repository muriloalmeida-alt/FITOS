import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { searchExercises } from "@/integrations/api-ninjas";
import type { ExerciseDTO, SearchExercisesInput } from "@/integrations/api-ninjas";
import { buildCatalogImportManifest, hashCatalogImportManifest } from "./catalogImportManifest";
import { importGlobalExercises } from "./importExercises";
import {
  advanceCatalogImportRun,
  completeCatalogImportRun,
  failCatalogImportRun,
  startCatalogImportRun,
  type CatalogImportEnvironmentInput,
} from "./catalogImportRun";

/// Orquestração da carga do catálogo (IMP-EX-001) — única implementação,
/// usada pelo comando administrativo (`scripts/import-exercicios.ts`) e
/// pela rota HTTP interna (`src/app/api/admin/catalog-import/route.ts`,
/// exceção registrada). As duas entradas nunca duplicam esta lógica.

const IMPORTER_VERSION = "imp-ex-001-v1";
const MAX_ATTEMPTS_PER_QUERY = 3;
const BACKOFF_BASE_MS = 500;

function withBackoff(searchFn: typeof searchExercises): typeof searchExercises {
  return async (input: SearchExercisesInput, options): Promise<ExerciseDTO[]> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_QUERY; attempt += 1) {
      try {
        return await searchFn(input, options);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS_PER_QUERY) {
          await new Promise((resolve) => setTimeout(resolve, BACKOFF_BASE_MS * attempt));
        }
      }
    }
    throw lastError;
  };
}

export interface CatalogImportDryRunReport {
  manifestVersion: string;
  queries: number;
  received: number;
  valid: number;
  failedSearches: number;
}

/// `--dry-run`: valida credencial/contrato/volume com chamadas reais de
/// leitura à API Ninjas — nunca grava no banco, nunca cria uma linha em
/// `CatalogImportRun` (critério de aceite "dry-run não grava registros").
export async function runCatalogImportDryRun(): Promise<CatalogImportDryRunReport> {
  const manifest = buildCatalogImportManifest();

  let received = 0;
  let valid = 0;
  let failedSearches = 0;
  for (const query of manifest.queries) {
    try {
      const items = await searchExercises(query, {});
      received += items.length;
      valid += items.filter((item) => Boolean(item.name)).length;
    } catch {
      failedSearches += 1;
    }
  }

  return { manifestVersion: manifest.version, queries: manifest.queries.length, received, valid, failedSearches };
}

export interface RunCatalogImportInput {
  environment: CatalogImportEnvironmentInput;
  autorizadoPor: string;
  forceReimportNote?: string;
}

export interface CatalogImportSummary {
  runId: string;
  environment: CatalogImportEnvironmentInput;
  resumedFromCheckpoint: number;
  received: number;
  inserted: number;
  updated: number;
  ignored: number;
  errors: number;
}

/// Carga real (não `--dry-run`): inicia/retoma via `startCatalogImportRun`
/// (trava de concorrência/segunda carga, retomada de `FAILED`), processa o
/// manifesto a partir do `checkpoint`, e finaliza com `COMPLETED` ou
/// `FAILED`. Nunca chamada automaticamente — só pelo comando administrativo
/// ou pela rota HTTP interna, ambos exigindo `autorizadoPor` explícito.
export async function runCatalogImport(input: RunCatalogImportInput, client: PrismaClient = prisma): Promise<CatalogImportSummary> {
  const manifest = buildCatalogImportManifest();
  const manifestHash = hashCatalogImportManifest(manifest);

  const run = await startCatalogImportRun(
    {
      environment: input.environment,
      importerVersion: IMPORTER_VERSION,
      manifestHash,
      executor: input.autorizadoPor,
      forceReimportNote: input.forceReimportNote,
    },
    client
  );

  const resumedFromCheckpoint = run.checkpoint;
  const searchWithBackoff = withBackoff(searchExercises);

  try {
    for (let index = run.checkpoint; index < manifest.queries.length; index += 1) {
      const query = manifest.queries[index]!;
      const partial = await importGlobalExercises([query], client, searchWithBackoff);

      await advanceCatalogImportRun(
        run.id,
        {
          checkpoint: index + 1,
          received: partial.received,
          inserted: partial.created,
          updated: partial.updated,
          ignored: partial.rejected,
          errors: partial.failedSearches,
        },
        client
      );
    }

    const completed = await completeCatalogImportRun(run.id, client);
    return {
      runId: completed.id,
      environment: completed.environment,
      resumedFromCheckpoint,
      received: completed.received,
      inserted: completed.inserted,
      updated: completed.updated,
      ignored: completed.ignored,
      errors: completed.errors,
    };
  } catch (error) {
    await failCatalogImportRun(run.id, client);
    throw error;
  }
}
