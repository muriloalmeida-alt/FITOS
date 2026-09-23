import "server-only";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { buildExerciseObjectKey } from "./r2Config";
import { detectContentType } from "./r2Client";

/// Vínculo de imagens ilustradas ao catálogo global (FIT-111, seção 8B do
/// pacote; storage migrado de `public/media/exercises` para Cloudflare R2 —
/// ver `docs/06-engenharia/arquitetura/ARMAZENAMENTO-DE-MIDIA-EXERCICIOS.md`
/// e ADR-010). Ao contrário de `importCuratedCatalog.ts` (que cria/atualiza
/// exercícios), este módulo **nunca cria um `Exercise` novo** — ele só
/// grava `imageUrl`/`imageAlt` num registro `FITOS_CURATED` que já existe
/// (importado pela IMP-EX-002), localizado pela mesma chave estável
/// (`[origin, externalId]`) que a IMP-EX-002 já usa. Isso satisfaz
/// literalmente a regra do pacote ("não duplicar exercícios já existentes
/// no banco" + "vincular as imagens aos registros corretos por chave
/// estável") sem inventar um segundo caminho de criação de exercício.
/// Um `canonicalKey` do manifesto sem `Exercise` correspondente é sempre
/// falha reportada (`falho`), nunca criação silenciosa.
///
/// Upload e URL pública são injetados (`uploadImage`/`buildImageUrl`), nunca
/// chamados diretamente daqui — o mesmo padrão já usado por `readImageFile`.
/// Isso mantém este módulo testável sem rede/credenciais reais e permite ao
/// script CLI decidir a implementação real (R2) só na borda do processo.

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

/// Checksum do asset (sha256) — não persistido no banco (os dois campos do
/// `Exercise` são só `imageUrl`/`imageAlt`); serve apenas ao relatório desta
/// importação, para o operador confirmar que o arquivo físico realmente
/// corresponde ao que foi lido em cada execução (rastreabilidade pedida
/// pelo pacote), sem exigir uma coluna nova só para isso.
function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface ReadImageFileResult {
  buffer: Buffer;
  /// Extensão real do arquivo encontrado no disco (`"webp"` ou `"png"`) —
  /// nunca assumida fixa, exigência explícita ("não altere extensão apenas
  /// no nome; detecte e envie o Content-Type real").
  extension: string;
  contentType: string;
}

export type ReadImageFile = (slug: string) => Promise<ReadImageFileResult>;

const SUPPORTED_EXTENSIONS = ["webp", "png"] as const;

export class ExerciseImageAssetError extends Error {}

/// Lê o asset local de `publicDir/<slug>.<ext>`, preferindo `.webp` e
/// caindo para `.png` quando o webp não existir (seção 5 do escopo: "se o
/// pacote aprovado estiver em PNG e a conversão ainda não for comprovadamente
/// lossless"). Nenhuma das duas presentes é sempre `ExerciseImageAssetError`
/// — nunca uma exceção genérica de I/O difícil de reportar no relatório.
export function createPublicDirImageReader(publicDir: string): ReadImageFile {
  return async (slug: string): Promise<ReadImageFileResult> => {
    for (const extension of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(publicDir, `${slug}.${extension}`);
      try {
        await access(filePath);
      } catch {
        continue;
      }
      const buffer = await readFile(filePath);
      return { buffer, extension, contentType: detectContentType(extension) };
    }
    throw new ExerciseImageAssetError(
      `Nenhum arquivo de imagem encontrado para o slug "${slug}" em ${publicDir} (esperado .webp ou .png).`
    );
  };
}

/// URL pública final do objeto (R2 ou qualquer storage equivalente) — pura,
/// sem I/O. O script CLI injeta a implementação real (a partir de
/// `r2Config.buildPublicImageUrl`); testes injetam uma função qualquer.
export type BuildImageUrl = (objectKey: string) => string;

export interface UploadImageInput {
  key: string;
  body: Buffer;
  contentType: string;
}

/// Envia e confirma o objeto no storage (R2). Deve lançar em qualquer falha
/// — de upload ou de confirmação — nunca resolver silenciosamente; é isso
/// que garante que o banco só é atualizado depois do upload confirmado.
/// Nunca chamada durante `dryRun`.
export type UploadImage = (input: UploadImageInput) => Promise<void>;

export interface ImportExerciseImagesOptions {
  dryRun?: boolean;
  readImageFile: ReadImageFile;
  buildImageUrl: BuildImageUrl;
  uploadImage: UploadImage;
}

/// Vincula cada entrada do manifesto ao `Exercise` `FITOS_CURATED`
/// correspondente. Cada entrada é processada isoladamente (try/catch por
/// item, nunca uma transação única para o lote inteiro) — uma falha num
/// item (arquivo ausente, `canonicalKey` sem correspondência, upload que não
/// confirma) nunca aborta nem corrompe o processamento dos demais, exigência
/// explícita do pacote ("falha parcial sem corromper o catálogo"). O banco
/// só é escrito depois do upload confirmado (`uploadImage` resolvido sem
/// lançar) — uma falha de upload ou de confirmação nunca chega a
/// `client.exercise.update`. Idempotente: reexecutar sem mudança nenhuma no
/// manifesto/URL alvo marca tudo como `ignorado` (nem lê o storage de novo
/// além do necessário para o checksum do relatório) — nunca um upload ou
/// escrita desnecessários.
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
      const { buffer, extension, contentType } = await options.readImageFile(entry.slug);
      const checksum = computeChecksum(buffer);
      const objectKey = buildExerciseObjectKey(entry.slug, extension);
      const targetImageUrl = options.buildImageUrl(objectKey);

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

      await options.uploadImage({ key: objectKey, body: buffer, contentType });

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
/// pelo manifesto informado. Nunca apaga o `Exercise` em si, e nunca apaga o
/// objeto correspondente no bucket R2 — exclusão de objeto exigiria uma flag
/// explícita adicional que este módulo deliberadamente não implementa (risco
/// desproporcional ao benefício: o objeto órfão não é servido a ninguém sem
/// um `Exercise.imageUrl` apontando pra ele).
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

/// Validação semântica do manifesto (distinta do parse de forma): chaves
/// estáveis (`canonicalKey`) e `slug` devem ser únicas — uma chave duplicada
/// vincularia/desvincularia o mesmo `Exercise` de forma indeterminística
/// dependendo da ordem de iteração, e um `slug` duplicado colidiria no
/// mesmo objeto do bucket para dois exercícios diferentes. Também exige
/// `canonicalKey`, `slug` e `altText` não vazios. Lança listando todas as
/// chaves/slugs problemáticos de uma vez (não só o primeiro), para o
/// operador corrigir o manifesto numa única rodada.
export function validateExerciseImageManifest(manifest: ExerciseImageManifestEntry[]): void {
  const problems: string[] = [];

  const emptyField = manifest.filter((entry) => !entry.canonicalKey || !entry.slug || !entry.altText);
  if (emptyField.length > 0) {
    problems.push(
      `${emptyField.length} entrada(s) com canonicalKey/slug/altText vazio: ${emptyField
        .map((entry) => entry.arquivoOriginal || "(sem arquivoOriginal)")
        .join(", ")}.`
    );
  }

  const duplicatedCanonicalKeys = findDuplicates(manifest.map((entry) => entry.canonicalKey));
  if (duplicatedCanonicalKeys.length > 0) {
    problems.push(`canonicalKey duplicada(s): ${duplicatedCanonicalKeys.join(", ")}.`);
  }

  const duplicatedSlugs = findDuplicates(manifest.map((entry) => entry.slug));
  if (duplicatedSlugs.length > 0) {
    problems.push(`slug duplicado(s): ${duplicatedSlugs.join(", ")}.`);
  }

  if (problems.length > 0) {
    throw new ExerciseImageManifestError(`Manifesto de imagens inválido — ${problems.join(" ")}`);
  }
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicated.add(value);
    }
    seen.add(value);
  }
  return [...duplicated];
}
