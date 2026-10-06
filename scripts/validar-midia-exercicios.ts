/**
 * Auditoria de cobertura de mídia da biblioteca de exercícios.
 *
 * Uso:
 *   npm run exercises:validate-media              # banco + manifesto
 *   npm run exercises:validate-media -- --http    # também confere cada URL (200, image/webp, bytes WebP)
 *
 * Usa DATABASE_URL e, se definido, R2_PUBLIC_BASE_URL (exige
 * imageUrl = <base>/<slug>.webp do manifesto). Só leitura. Sai com código
 * 1 se houver qualquer pendência.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseExerciseImageManifest } from "../src/modules/exercises/importExerciseImages";
import { auditMediaCoverage, checkImageUrl, coverageProblems, loadLibrary } from "../src/modules/exercises/mediaCoverage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, "..", "src", "modules", "exercises", "data", "manifesto-imagens-exercicios.json");

async function main(): Promise<void> {
  const http = process.argv.includes("--http");
  const manifest = parseExerciseImageManifest(await readFile(MANIFEST_PATH, "utf-8"));
  const prisma = new PrismaClient();
  try {
    const exercises = await loadLibrary(prisma);
    const base = process.env.R2_PUBLIC_BASE_URL || null;
    const report = auditMediaCoverage(exercises, manifest, base);
    const list = (label: string, items: unknown[]) => {
      console.log(`${label}: ${items.length}`);
      for (const item of items.slice(0, 50)) console.log(`  - ${typeof item === "string" ? item : JSON.stringify(item)}`);
    };
    console.log(`Manifesto: ${manifest.length} entradas`);
    console.log(`Exercícios na biblioteca: ${report.total}`);
    console.log(`Com imagem: ${report.withImage}`);
    list("Sem imagem", report.withoutImage);
    list("Com imagem e sem texto alternativo", report.withoutAlt);
    list("externalId duplicado", report.duplicatedExternalIds);
    list("Nome duplicado", report.duplicatedNames);
    list("URL duplicada", report.duplicatedUrls);
    list("Exercício sem entrada no manifesto", report.exercisesWithoutManifest);
    list("Manifesto sem exercício", report.manifestWithoutExercise);
    if (base) {
      list("URL fora da base pública", report.outsideBaseUrl);
      list("URL diferente da esperada (<base>/<slug>.webp)", report.urlMismatch);
    } else {
      console.log("R2_PUBLIC_BASE_URL ausente: padrão da URL não conferido.");
    }
    let broken = 0;
    if (http) {
      const urls = exercises.flatMap((exercise) => (exercise.imageUrl ? [exercise.imageUrl] : []));
      const results = [];
      for (let index = 0; index < urls.length; index += 8) {
        results.push(...(await Promise.all(urls.slice(index, index + 8).map((url) => checkImageUrl(url)))));
      }
      const bad = results.filter((result) => !result.ok);
      broken = bad.length;
      console.log(`URLs conferidas por HTTP: ${results.length}`);
      list("URLs quebradas", bad.map((result) => `${result.url} → ${result.reason}`));
    }
    const problems = coverageProblems(report) + broken;
    console.log(problems === 0 ? `OK: ${report.withImage}/${report.total} com imagem, 0 pendências.` : `FALHOU: ${problems} pendência(s).`);
    if (problems > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[exercises:validate-media] falha:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
