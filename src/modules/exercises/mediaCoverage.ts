import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { ExerciseImageManifestEntry } from "./importExerciseImages";

/// Auditoria de cobertura de mídia da biblioteca global de exercícios
/// (`npm run exercises:validate-media`). Só lê: banco, manifesto e, se
/// pedido, as URLs públicas por HTTP. Nunca escreve nada.

export interface CoverageExercise {
  id: string;
  externalId: string | null;
  name: string;
  status: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface MediaCoverageReport {
  total: number;
  withImage: number;
  withoutImage: { externalId: string | null; name: string }[];
  withoutAlt: { externalId: string | null; name: string }[];
  duplicatedExternalIds: string[];
  duplicatedNames: string[];
  duplicatedUrls: string[];
  outsideBaseUrl: { externalId: string | null; imageUrl: string }[];
  manifestWithoutExercise: string[];
  exercisesWithoutManifest: { externalId: string | null; name: string }[];
  urlMismatch: { externalId: string; expected: string; actual: string | null }[];
}

function duplicates(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of values) {
    if (value === null) continue;
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup].sort();
}

/// Biblioteca global: `tenantId` nulo e origem diferente de `PERSONAL`
/// (mesma definição do catálogo em `exercises.ts`).
export async function loadLibrary(client: PrismaClient = prisma): Promise<CoverageExercise[]> {
  return client.exercise.findMany({
    where: { tenantId: null, origin: { not: "PERSONAL" } },
    select: { id: true, externalId: true, name: true, status: true, imageUrl: true, imageAlt: true },
    orderBy: { externalId: "asc" },
  });
}

/// Confere a biblioteca contra o manifesto. `publicBaseUrl` (sem barra
/// final), quando informado, exige que cada `imageUrl` seja exatamente
/// `<base>/<slug>.webp` da entrada do manifesto (mesma regra do modo
/// `--public-only` do importador).
export function auditMediaCoverage(exercises: CoverageExercise[], manifest: ExerciseImageManifestEntry[], publicBaseUrl?: string | null): MediaCoverageReport {
  const base = publicBaseUrl?.replace(/\/+$/u, "") ?? null;
  const byKey = new Map(exercises.map((exercise) => [exercise.externalId, exercise]));
  const manifestKeys = new Set(manifest.map((entry) => entry.canonicalKey));
  const ref = (exercise: CoverageExercise) => ({ externalId: exercise.externalId, name: exercise.name });

  return {
    total: exercises.length,
    withImage: exercises.filter((exercise) => exercise.imageUrl).length,
    withoutImage: exercises.filter((exercise) => !exercise.imageUrl).map(ref),
    withoutAlt: exercises.filter((exercise) => exercise.imageUrl && !exercise.imageAlt).map(ref),
    duplicatedExternalIds: duplicates(exercises.map((exercise) => exercise.externalId)),
    duplicatedNames: duplicates(exercises.map((exercise) => exercise.name)),
    duplicatedUrls: duplicates(exercises.map((exercise) => exercise.imageUrl)),
    outsideBaseUrl: base ? exercises.filter((exercise) => exercise.imageUrl && !exercise.imageUrl.startsWith(`${base}/`)).map((exercise) => ({ externalId: exercise.externalId, imageUrl: exercise.imageUrl! })) : [],
    manifestWithoutExercise: manifest.filter((entry) => !byKey.has(entry.canonicalKey)).map((entry) => entry.canonicalKey),
    exercisesWithoutManifest: exercises.filter((exercise) => !exercise.externalId || !manifestKeys.has(exercise.externalId)).map(ref),
    urlMismatch: base
      ? manifest.flatMap((entry) => {
          const exercise = byKey.get(entry.canonicalKey);
          const expected = `${base}/${entry.slug}.webp`;
          return exercise && exercise.imageUrl !== expected ? [{ externalId: entry.canonicalKey, expected, actual: exercise.imageUrl }] : [];
        })
      : [],
  };
}

export function coverageProblems(report: MediaCoverageReport): number {
  return (
    report.withoutImage.length +
    report.withoutAlt.length +
    report.duplicatedExternalIds.length +
    report.duplicatedNames.length +
    report.duplicatedUrls.length +
    report.outsideBaseUrl.length +
    report.manifestWithoutExercise.length +
    report.exercisesWithoutManifest.length +
    report.urlMismatch.length
  );
}

export interface UrlCheck {
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  reason?: string;
}

/// WebP real pelos primeiros bytes: "RIFF" .... "WEBP".
export function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

/// GET da URL pública (sem seguir redirecionamento): exige 200,
/// `Content-Type: image/webp` e bytes de WebP — nunca aceita página HTML
/// de erro com 200.
export async function checkImageUrl(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 15_000): Promise<UrlCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "manual", signal: controller.signal });
    const contentType = response.headers.get("content-type");
    if (response.status !== 200) return { url, ok: false, status: response.status, contentType, reason: `HTTP ${response.status}` };
    if (!contentType?.toLowerCase().startsWith("image/webp")) return { url, ok: false, status: 200, contentType, reason: `Content-Type ${contentType ?? "ausente"}` };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isWebp(bytes)) return { url, ok: false, status: 200, contentType, reason: "conteúdo não é WebP" };
    return { url, ok: true, status: 200, contentType };
  } catch (error) {
    return { url, ok: false, status: null, contentType: null, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
