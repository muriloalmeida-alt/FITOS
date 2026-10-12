/**
 * Garante o catálogo global de exercícios num banco novo (produção). Roda a
 * cada deploy (`railway.json`, `deploy.preDeployCommand`), depois das
 * migrations: cria os exercícios curados que faltam e, se criou algum,
 * reaplica as migrations de dados do catálogo (imagens, aeróbicos,
 * Funcional). Num banco que já tem o catálogo, não faz nada. Nunca derruba
 * o deploy: um erro fica no log.
 *
 * Uso manual: npm run catalog:garantir
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseCuratedCatalogCsv } from "../src/modules/exercises/importCuratedCatalog";
import { ensureCuratedCatalog } from "../src/modules/exercises/ensureCatalog";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(root, "src", "modules", "exercises", "data", "catalogo-exercicios-fitos-ptbr.csv");
const MIGRATIONS_DIR = path.join(root, "prisma", "migrations");

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const records = parseCuratedCatalogCsv(await readFile(CSV_PATH, "utf-8"));
    const names = (await readdir(MIGRATIONS_DIR, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const migrations = await Promise.all(names.map(async (name) => ({ name, sql: await readFile(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8").catch(() => "") })));
    const result = await ensureCuratedCatalog({ records, migrations }, prisma);
    console.log(result.created === 0 ? "[catalog:garantir] catálogo completo; nada a fazer." : `[catalog:garantir] ${result.created} exercício(s) criado(s); ${result.replayed} ajuste(s) das migrations reaplicado(s).`);
  } catch (error) {
    console.error(`[catalog:garantir] falhou: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
