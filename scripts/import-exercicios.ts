/**
 * IMP-EX-001 — comando administrativo da carga única do catálogo global a
 * partir da API Ninjas. Execução manual apenas — nunca chamado pelo build,
 * seed, deploy ou acesso à página.
 *
 * Uso:
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --dry-run
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --autorizado-por="Nome Sobrenome"
 *   npm run catalog:import-api-ninjas -- --environment=producao --autorizado-por="Nome Sobrenome" --autorizar-producao
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --autorizado-por="Nome Sobrenome" --force-reimport --justificativa="motivo auditado"
 *
 * Sem `API_NINJAS_API_KEY` configurada, encerra imediatamente sem nenhuma
 * chamada de rede ou escrita no banco (mesmo comportamento desde a FIT-021).
 *
 * Reexecutar o mesmo comando após uma falha (`FAILED`) retoma automaticamente
 * a partir do checkpoint salvo — não existe flag separada de retomada.
 * Reexecutar após sucesso (`COMPLETED`) é recusado, a menos que
 * `--force-reimport` e `--justificativa` sejam informados (reimportação
 * excepcional autorizada por Produto, IMP-EX-001 critério 5).
 */
import { PrismaClient } from "@prisma/client";
import { searchExercises } from "../src/integrations/api-ninjas";
import type { ExerciseDTO, SearchExercisesInput } from "../src/integrations/api-ninjas";
import { buildCatalogImportManifest, hashCatalogImportManifest } from "../src/modules/exercises/catalogImportManifest";
import { importGlobalExercises } from "../src/modules/exercises/importExercises";
import {
  advanceCatalogImportRun,
  completeCatalogImportRun,
  failCatalogImportRun,
  startCatalogImportRun,
  type CatalogImportEnvironmentInput,
} from "../src/modules/exercises/catalogImportRun";

const IMPORTER_VERSION = "imp-ex-001-v1";
const MAX_ATTEMPTS_PER_QUERY = 3;
const BACKOFF_BASE_MS = 500;

interface Args {
  environment: CatalogImportEnvironmentInput;
  dryRun: boolean;
  autorizadoPor?: string;
  forceReimport: boolean;
  justificativa?: string;
  autorizarProducao: boolean;
}

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  for (const raw of argv) {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    if (!key) {
      continue;
    }
    flags.set(key, rest.join("="));
  }

  const environmentRaw = flags.get("environment");
  if (environmentRaw !== "homologacao" && environmentRaw !== "producao") {
    throw new Error('--environment=homologacao ou --environment=producao é obrigatório.');
  }

  return {
    environment: environmentRaw === "homologacao" ? "HOMOLOGACAO" : "PRODUCAO",
    dryRun: flags.has("dry-run"),
    autorizadoPor: flags.get("autorizado-por"),
    forceReimport: flags.has("force-reimport"),
    justificativa: flags.get("justificativa"),
    autorizarProducao: flags.has("autorizar-producao"),
  };
}

function validateArgs(args: Args): void {
  if (args.dryRun) {
    return;
  }
  if (!args.autorizadoPor) {
    throw new Error("--autorizado-por=<nome ou identificador> é obrigatório fora de --dry-run.");
  }
  if (args.environment === "PRODUCAO" && !args.autorizarProducao) {
    throw new Error("Produção exige --autorizar-producao explicitamente, além de --autorizado-por.");
  }
  if (args.forceReimport && !args.justificativa) {
    throw new Error("--force-reimport exige --justificativa=<motivo auditado>.");
  }
}

/// Repetição com backoff exponencial para falhas transitórias (429/5xx,
/// timeout) — cada consulta do manifesto tenta no máximo
/// `MAX_ATTEMPTS_PER_QUERY` vezes antes de contar como busca falhada
/// (mesmo comportamento tolerante de `importGlobalExercises`: uma consulta
/// que esgota as tentativas não aborta as demais).
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

async function runDryRun(): Promise<void> {
  const manifest = buildCatalogImportManifest();
  console.log(
    `[catalog:import-api-ninjas] dry-run — manifesto ${manifest.version} (${manifest.queries.length} consultas). ` +
      "Nenhuma escrita será feita no banco."
  );

  let received = 0;
  let valid = 0;
  let failedSearches = 0;
  for (const query of manifest.queries) {
    try {
      const items = await searchExercises(query, {});
      received += items.length;
      valid += items.filter((item) => Boolean(item.name)).length;
    } catch (error) {
      failedSearches += 1;
      console.warn(`[catalog:import-api-ninjas] consulta falhou em dry-run:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    "[catalog:import-api-ninjas] resultado do dry-run:",
    JSON.stringify({ manifestVersion: manifest.version, queries: manifest.queries.length, received, valid, failedSearches })
  );
}

async function runImport(args: Args): Promise<void> {
  const manifest = buildCatalogImportManifest();
  const manifestHash = hashCatalogImportManifest(manifest);
  const prisma = new PrismaClient();

  console.log(
    `[catalog:import-api-ninjas] ambiente=${args.environment} autorizado-por="${args.autorizadoPor}" ` +
      `manifesto=${manifest.version} (hash ${manifestHash.slice(0, 12)}…)`
  );

  try {
    const run = await startCatalogImportRun(
      {
        environment: args.environment,
        importerVersion: IMPORTER_VERSION,
        manifestHash,
        executor: args.autorizadoPor!,
        forceReimportNote: args.forceReimport ? args.justificativa : undefined,
      },
      prisma
    );

    if (run.checkpoint > 0) {
      console.log(`[catalog:import-api-ninjas] retomando execução ${run.id} a partir da consulta ${run.checkpoint}.`);
    }

    const searchWithBackoff = withBackoff(searchExercises);

    try {
      for (let index = run.checkpoint; index < manifest.queries.length; index += 1) {
        const query = manifest.queries[index]!;
        const partial = await importGlobalExercises([query], prisma, searchWithBackoff);

        await advanceCatalogImportRun(run.id, {
          checkpoint: index + 1,
          received: partial.received,
          inserted: partial.created,
          updated: partial.updated,
          ignored: partial.rejected,
          errors: partial.failedSearches,
        });
      }

      const completed = await completeCatalogImportRun(run.id, prisma);
      console.log(
        "[catalog:import-api-ninjas] concluído:",
        JSON.stringify({
          runId: completed.id,
          environment: completed.environment,
          received: completed.received,
          inserted: completed.inserted,
          updated: completed.updated,
          ignored: completed.ignored,
          errors: completed.errors,
        })
      );
    } catch (error) {
      await failCatalogImportRun(run.id, prisma);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  if (!process.env.API_NINJAS_API_KEY) {
    console.log(
      "[catalog:import-api-ninjas] API_NINJAS_API_KEY não está configurada — importação indisponível. " +
        "Nenhuma chamada de rede ou escrita no banco foi feita."
    );
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  if (args.dryRun) {
    await runDryRun();
    return;
  }

  await runImport(args);
}

main().catch((error) => {
  console.error("[catalog:import-api-ninjas] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
