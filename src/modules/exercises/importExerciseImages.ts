import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Vínculo de imagens ilustradas ao catálogo global (FIT-111, seção 8B do
/// pacote). Ao contrário de `importCuratedCatalog.ts` (que cria/atualiza
/// exercícios), este módulo **nunca cria um `Exercise` novo** — ele só
/// grava `imageUrl`/`imageAlt` num registro `FITOS_CURATED` que já existe
/// (importado pela IMP-EX-002), localizado pela mesma chave estável
/// (`[origin, externalId]`) que a IMP-EX-002 já usa. Isso satisfaz
/// literalmente a regra do pacote ("não duplicar exercícios já existentes
/// no banco" + "vincular as imagens aos registros corretos por chave
/// estável") sem inventar um segundo caminho de criação de exercício.
/// Um `canonicalKey` do manifesto sem `Exercise` correspondente é sempre
/// falha reportada (`falho`), nunca criação silenciosa.

export interface ExerciseImageManifestEntry {
  arquivoOriginal: string;
  canonicalKey: string;
  slug: string;
  nomeCanonico: string;
  musculo: string | null;
  equipamento: string | null;
  aliases: string[];
  duasFases: boolean;
  altText: string;
  width: number;
  height: number;
}

export type ExerciseImageOutcomeKind = "importado" | "atualizado" | "ignorado" | "falho" | "simulado";

export interface ExerciseImageOutcome {
  slug: string;
  canonicalKey: string;
  kind: ExerciseImageOutcomeKind;
  exerciseId: string | null;
  checksum: string | null;
  reason?: string;
}

export interface ImportExerciseImagesResult {
  total: number;
  importados: number;
  atualizados: number;
  ignorados: number;
  falhos: number;
  simulados: number;
  outcomes: ExerciseImageOutcome[];
}

/// Caminho público servido pelo Next.js (`public/media/exercises/<slug>.webp`)
/// — nunca um bucket ou URL assinada, conforme a regra de assets do pacote.
export function buildExerciseImageUrl(slug: string): string {
  return `/media/exercises/${slug}.webp`;
}

/// Checksum do asset (sha256) — não persistido no banco (os dois campos do
/// `Exercise` são só `imageUrl`/`imageAlt`); serve apenas ao relatório desta
/// importação, para o operador confirmar que o arquivo físico realmente
/// corresponde ao que foi lido em cada execução (rastreabilidade pedida
/// pelo pacote), sem exigir uma coluna nova só para isso.
function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type ReadImageFile = (slug: string) => Promise<Buffer>;

export function createPublicDirImageReader(publicDir: string): ReadImageFile {
  return async (slug: string) => readFile(path.join(publicDir, `${slug}.webp`));
}

export interface ImportExerciseImagesOptions {
  dryRun?: boolean;
  readImageFile: ReadImageFile;
}

/// Vincula cada entrada do manifesto ao `Exercise` `FITOS_CURATED`
/// correspondente. Cada entrada é processada isoladamente (try/catch por
/// item, nunca uma transação única para o lote inteiro) — uma falha num
/// item (arquivo ausente, `canonicalKey` sem correspondência) nunca aborta
/// nem corrompe o processamento dos demais, exigência explícita do pacote
/// ("falha parcial sem corromper o catálogo"). Idempotente: reexecutar sem
/// mudança nenhuma nos arquivos/manifesto marca tudo como `ignorado`
/// (`imageUrl`/`imageAlt` já batem com o valor alvo) — nunca uma segunda
/// escrita desnecessária.
export async function importExerciseImages(
  manifest: ExerciseImageManifestEntry[],
  options: ImportExerciseImagesOptions,
  client: PrismaClient = prisma
): Promise<ImportExerciseImagesResult> {
  const result: ImportExerciseImagesResult = {
    total: manifest.length,
    importados: 0,
    atualizados: 0,
    ignorados: 0,
    falhos: 0,
    simulados: 0,
    outcomes: [],
  };

  for (const entry of manifest) {
    try {
      const buffer = await options.readImageFile(entry.slug);
      const checksum = computeChecksum(buffer);
      const targetImageUrl = buildExerciseImageUrl(entry.slug);

      const existing = await client.exercise.findUnique({
        where: { origin_externalId: { origin: "FITOS_CURATED", externalId: entry.canonicalKey } },
      });

      if (!existing) {
        result.falhos += 1;
        result.outcomes.push({
          slug: entry.slug,
          canonicalKey: entry.canonicalKey,
          kind: "falho",
          exerciseId: null,
          checksum,
          reason: "Nenhum exercício FITOS_CURATED encontrado para este canonicalKey — verifique a IMP-EX-002.",
        });
        continue;
      }

      const alreadyUpToDate = existing.imageUrl === targetImageUrl && existing.imageAlt === entry.altText;
      if (alreadyUpToDate) {
        result.ignorados += 1;
        result.outcomes.push({
          slug: entry.slug,
          canonicalKey: entry.canonicalKey,
          kind: "ignorado",
          exerciseId: existing.id,
          checksum,
        });
        continue;
      }

      const isFirstImport = existing.imageUrl === null;
      if (options.dryRun) {
        result.simulados += 1;
        result.outcomes.push({
          slug: entry.slug,
          canonicalKey: entry.canonicalKey,
          kind: "simulado",
          exerciseId: existing.id,
          checksum,
          reason: isFirstImport ? "seria importado" : "seria atualizado",
        });
        continue;
      }

      await client.exercise.update({
        where: { id: existing.id },
        data: { imageUrl: targetImageUrl, imageAlt: entry.altText },
      });

      if (isFirstImport) {
        result.importados += 1;
        result.outcomes.push({ slug: entry.slug, canonicalKey: entry.canonicalKey, kind: "importado", exerciseId: existing.id, checksum });
      } else {
        result.atualizados += 1;
        result.outcomes.push({ slug: entry.slug, canonicalKey: entry.canonicalKey, kind: "atualizado", exerciseId: existing.id, checksum });
      }
    } catch (error) {
      result.falhos += 1;
      result.outcomes.push({
        slug: entry.slug,
        canonicalKey: entry.canonicalKey,
        kind: "falho",
        exerciseId: null,
        checksum: null,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/// Compensação segura (pedida pelo pacote como "rollback ou compensação
/// segura"): limpa `imageUrl`/`imageAlt` de todo `Exercise` referenciado
/// pelo manifesto informado. Nunca apaga o `Exercise` em si — só desfaz o
/// vínculo de imagem, a única mudança que esta importação faz.
export async function revertExerciseImages(
  manifest: ExerciseImageManifestEntry[],
  client: PrismaClient = prisma
): Promise<{ revertidos: number }> {
  const result = await client.exercise.updateMany({
    where: {
      origin: "FITOS_CURATED",
      externalId: { in: manifest.map((entry) => entry.canonicalKey) },
    },
    data: { imageUrl: null, imageAlt: null },
  });
  return { revertidos: result.count };
}

/// Erro de leitura do manifesto JSON — validação mínima para detectar um
/// arquivo corrompido/mal formado antes de tocar o banco.
export class ExerciseImageManifestError extends Error {}

export function parseExerciseImageManifest(jsonContent: string): ExerciseImageManifestEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonContent);
  } catch {
    throw new ExerciseImageManifestError("Manifesto de imagens não é um JSON válido.");
  }
  if (!Array.isArray(data)) {
    throw new ExerciseImageManifestError("Manifesto de imagens deve ser uma lista.");
  }
  return data as ExerciseImageManifestEntry[];
}
