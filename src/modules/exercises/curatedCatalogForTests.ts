import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { importCuratedCatalog, parseCuratedCatalogCsv } from "./importCuratedCatalog";

/// Só para testes de integração: garante o catálogo curado no banco de
/// testes (o mesmo CSV do deploy). Idempotente.
export async function ensureCuratedCatalogForTests(client: PrismaClient): Promise<void> {
  const count = await client.exercise.count({ where: { origin: "FITOS_CURATED", NOT: { type: "Aeróbico" } } });
  if (count > 100) return;
  const csv = await readFile(path.join(process.cwd(), "src", "modules", "exercises", "data", "catalogo-exercicios-fitos-ptbr.csv"), "utf-8");
  await importCuratedCatalog(parseCuratedCatalogCsv(csv), client);
}
