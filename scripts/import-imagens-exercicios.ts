/**
 * FIT-111 — vínculo único e idempotente das ilustrações de exercícios
 * ao catálogo `FITOS_CURATED` já existente (IMP-EX-002), a partir do
 * manifesto versionado `src/modules/exercises/data/manifesto-imagens-exercicios.json`.
 *
 * Storage: Cloudflare R2 (migração pós-FIT-111 — ver
 * docs/06-engenharia/arquitetura/ARMAZENAMENTO-DE-MIDIA-EXERCICIOS.md e
 * ADR-010). O asset físico é lido de `public/media/exercises/<slug>.<ext>`
 * (fonte local versionada), enviado ao bucket R2 e só então o banco recebe
 * a URL pública correspondente.
 *
 * Nunca cria um `Exercise` novo — só grava `imageUrl`/`imageAlt` num
 * registro já existente, localizado por `canonicalKey` (chave estável).
 * Execução manual apenas — nunca chamado pelo build, seed ou deploy.
 *
 * Uso:
 *   npm run catalog:import-imagens-exercicios -- --dry-run
 *   npm run catalog:import-imagens-exercicios
 *   npm run catalog:import-imagens-exercicios -- --revert
 *
 * `--dry-run` nunca requer as variáveis R2 configuradas (não faz upload,
 * não faz nenhuma chamada de rede) — valida manifesto, presença/legibilidade
 * dos assets locais e, se as variáveis R2 estiverem ausentes, avisa quais
 * (só o nome, nunca o valor) sem bloquear o restante da validação.
 * A execução real exige a configuração R2 completa.
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
  validateExerciseImageManifest,
  type BuildImageUrl,
  type UploadImage,
} from "../src/modules/exercises/importExerciseImages";
import { buildPublicImageUrl, listMissingR2EnvVars, readR2Config } from "../src/modules/exercises/r2Config";
import { createR2Client, uploadAndVerifyObject } from "../src/modules/exercises/r2Client";

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

/// Nunca chamada em `--dry-run` (o próprio `importExerciseImages` só chama
/// `uploadImage` fora do modo dry-run) — só existe para dar uma mensagem
/// clara caso, por engano de wiring futuro, algo tente fazer upload real
/// sem configuração R2 completa.
function createUnconfiguredUploader(missingVars: string[]): UploadImage {
  return async () => {
    throw new Error(
      `Upload real requer configuração R2 completa. Variável(is) ausente(s): ${missingVars.join(", ")}.`
    );
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const revert = args.includes("--revert");

  const manifestContent = await readFile(MANIFEST_PATH, "utf-8");
  const manifest = parseExerciseImageManifest(manifestContent);
  console.log(`[catalog:import-imagens-exercicios] ${manifest.length} entrada(s) lida(s) de ${MANIFEST_PATH}.`);

  try {
    validateExerciseImageManifest(manifest);
  } catch (error) {
    console.error(
      `[catalog:import-imagens-exercicios] manifesto inválido: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    if (revert) {
      const result = await revertExerciseImages(manifest, prisma);
      console.log(`[catalog:import-imagens-exercicios] revertido: ${result.revertidos} exercício(s) com imageUrl/imageAlt limpos.`);
      console.log("[catalog:import-imagens-exercicios] nenhum objeto do bucket R2 foi apagado (revert é só de banco).");
      return;
    }

    const missingR2Vars = listMissingR2EnvVars();
    if (missingR2Vars.length > 0) {
      console.warn(
        `[catalog:import-imagens-exercicios] variável(is) R2 ausente(s) (apenas nomes, nunca valores): ${missingR2Vars.join(", ")}.`
      );
    }

    if (!dryRun && missingR2Vars.length > 0) {
      console.error(
        "[catalog:import-imagens-exercicios] execução real requer todas as variáveis R2 configuradas — abortando antes de qualquer upload."
      );
      process.exitCode = 1;
      return;
    }

    let buildImageUrl: BuildImageUrl;
    let uploadImage: UploadImage;
    if (missingR2Vars.length === 0) {
      const r2Config = readR2Config();
      const r2Client = createR2Client(r2Config);
      buildImageUrl = (objectKey) => buildPublicImageUrl(r2Config, objectKey);
      uploadImage = async ({ key, body, contentType }) =>
        uploadAndVerifyObject({ client: r2Client, bucket: r2Config.bucketName, key, body, contentType });
    } else {
      // dry-run com config incompleta: URL alvo não pode ser calculada de
      // verdade — usamos um marcador só para o relatório não quebrar,
      // deixando explícito que aquele valor não é a URL final real.
      buildImageUrl = (objectKey) => `(config R2 incompleta — URL indisponível para simulação) ${objectKey}`;
      uploadImage = createUnconfiguredUploader(missingR2Vars);
    }

    const result = await importExerciseImages(
      manifest,
      { dryRun, readImageFile: createPublicDirImageReader(PUBLIC_DIR), buildImageUrl, uploadImage },
      prisma
    );

    const ausentes = result.outcomes.filter(
      (outcome) => outcome.kind === "falho" && outcome.reason?.includes("Nenhum arquivo de imagem encontrado")
    ).length;
    const novos = result.outcomes.filter((outcome) => outcome.kind === "simulado" && outcome.reason === "seria importado").length;
    const atualizaveis = result.outcomes.filter(
      (outcome) => outcome.kind === "simulado" && outcome.reason === "seria atualizado"
    ).length;
    const outrosFalhos = result.falhos - ausentes;

    console.log(
      `[catalog:import-imagens-exercicios] ${dryRun ? "(dry-run) " : ""}concluído: ` +
        `encontrados=${result.total} já_vinculados=${result.ignorados} novos=${novos} atualizáveis=${atualizaveis} ` +
        `ausentes=${ausentes} outros_falhos=${outrosFalhos} importados=${result.importados} atualizados=${result.atualizados}`
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
