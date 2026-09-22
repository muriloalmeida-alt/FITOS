/**
 * IMP-EX-002 — comando administrativo da carga do catálogo curado FITOS
 * em PT-BR, a partir do arquivo versionado
 * `src/modules/exercises/data/catalogo-exercicios-fitos-ptbr.csv`.
 * Execução manual apenas — nunca chamado pelo build, seed, deploy ou
 * acesso à página.
 *
 * Ao contrário de `catalog:import-api-ninjas` (FIT-021/IMP-EX-001), não há
 * chamada de rede, paginação, checkpoint ou lock: um único arquivo local,
 * lido do início ao fim, em uma única execução. A segurança contra
 * reexecução acidental vem do upsert idempotente por `[origin, externalId]`
 * em `importCuratedCatalog.ts` — rodar de novo nunca duplica nem perde dado.
 *
 * Uso:
 *   npm run catalog:import-curated
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { importCuratedCatalog, parseCuratedCatalogCsv } from "../src/modules/exercises/importCuratedCatalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "..", "src", "modules", "exercises", "data", "catalogo-exercicios-fitos-ptbr.csv");

async function main(): Promise<void> {
  const csvContent = await readFile(CSV_PATH, "utf-8");
  const records = parseCuratedCatalogCsv(csvContent);
  console.log(`[catalog:import-curated] ${records.length} exercício(s) lido(s) de ${CSV_PATH}.`);

  const prisma = new PrismaClient();
  try {
    const result = await importCuratedCatalog(records, prisma);
    console.log("[catalog:import-curated] concluído:", JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[catalog:import-curated] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
