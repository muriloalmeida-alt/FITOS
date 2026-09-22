/**
 * FIT-111 — vínculo único e idempotente das ilustrações de exercícios
 * (`assets/exercicios/` do pacote, já otimizadas em
 * `public/media/exercises/<slug>.webp`) aos registros `FITOS_CURATED`
 * já existentes no catálogo (IMP-EX-002), a partir do manifesto versionado
 * `src/modules/exercises/data/manifesto-imagens-exercicios.json`.
 *
 * Nunca cria um `Exercise` novo — só grava `imageUrl`/`imageAlt` num
 * registro já existente, localizado por `canonicalKey` (chave estável).
 * Execução manual apenas — nunca chamado pelo build, seed ou deploy.
 *
 * Uso:
 *   npm run catalog:import-imagens-exercicios -- --dry-run
 *   npm run catalog:import-imagens-exercicios
 *   npm run catalog:import-imagens-exercicios -- --revert
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  createPublicDirImageReader,
  importExerciseImages,
  parseExerciseImageManifest,
  revertExerciseImages,
} from "../src/modules/exercises/importExerciseImages";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "src",
  "modules",
  "exercises",
  "data",
  "manifesto-imagens-exercicios.json"
);
const PUBLIC_DIR = path.join(__dirname, "..", "public", "media", "exercises");

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const revert = args.includes("--revert");

  const manifestContent = await readFile(MANIFEST_PATH, "utf-8");
  const manifest = parseExerciseImageManifest(manifestContent);
  console.log(`[catalog:import-imagens-exercicios] ${manifest.length} entrada(s) lida(s) de ${MANIFEST_PATH}.`);

  const prisma = new PrismaClient();
  try {
    if (revert) {
      const result = await revertExerciseImages(manifest, prisma);
      console.log(`[catalog:import-imagens-exercicios] revertido: ${result.revertidos} exercício(s) com imageUrl/imageAlt limpos.`);
      return;
    }

    const result = await importExerciseImages(manifest, { dryRun, readImageFile: createPublicDirImageReader(PUBLIC_DIR) }, prisma);
    console.log(
      `[catalog:import-imagens-exercicios] ${dryRun ? "(dry-run) " : ""}concluído: total=${result.total} importados=${result.importados} atualizados=${result.atualizados} ignorados=${result.ignorados} simulados=${result.simulados} falhos=${result.falhos}`
    );
    for (const outcome of result.outcomes) {
      if (outcome.kind === "falho") {
        console.warn(`  [falho] ${outcome.slug} (${outcome.canonicalKey}): ${outcome.reason}`);
      }
    }
    if (result.falhos > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[catalog:import-imagens-exercicios] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
