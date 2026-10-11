import { describe, expect, it } from "vitest";
import type { ExerciseImageManifestEntry } from "./importExerciseImages";
import { auditMediaCoverage, checkImageUrl, coverageProblems, isWebp, type CoverageExercise } from "./mediaCoverage";

const BASE = "https://pub-exemplo.r2.dev";
const entry = (slug: string, canonicalKey = `fitos:${slug}`): ExerciseImageManifestEntry => ({ arquivoOriginal: `${slug}.webp`, canonicalKey, slug, nomeCanonico: slug, musculo: null, equipamento: null, aliases: [], duasFases: false, altText: slug, width: 1, height: 1 });
const exercise = (externalId: string, imageUrl: string | null, name = externalId): CoverageExercise => ({ id: externalId, externalId, name, status: "ATIVO", imageUrl, imageAlt: imageUrl ? "alt" : null });
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56]);

describe("cobertura de mídia da biblioteca", () => {
  it("tudo certo: 0 pendências, inclusive slug diferente da chave (aeróbicos)", () => {
    const report = auditMediaCoverage(
      [exercise("fitos:remada", `${BASE}/remada.webp`), exercise("fitos:aerobico-bike", `${BASE}/bike-ergometrica.webp`)],
      [entry("remada"), entry("bike-ergometrica", "fitos:aerobico-bike")],
      `${BASE}/`
    );
    expect(report).toMatchObject({ total: 2, withImage: 2 });
    expect(coverageProblems(report)).toBe(0);
  });

  it("aponta sem imagem, URL fora do padrão, duplicidades e manifesto sem exercício", () => {
    const report = auditMediaCoverage(
      [exercise("fitos:a", null), exercise("fitos:b", `${BASE}/exercises/b.webp`), exercise("fitos:c", `${BASE}/c.webp`, "Igual"), exercise("fitos:c", `${BASE}/c.webp`, "Igual")],
      [entry("a"), entry("b"), entry("c"), entry("x")],
      BASE
    );
    expect(report.withoutImage.map((item) => item.externalId)).toEqual(["fitos:a"]);
    expect(report.urlMismatch.map((item) => item.externalId)).toEqual(["fitos:a", "fitos:b"]);
    expect(report.duplicatedExternalIds).toEqual(["fitos:c"]);
    expect(report.duplicatedNames).toEqual(["Igual"]);
    expect(report.duplicatedUrls).toEqual([`${BASE}/c.webp`]);
    expect(report.manifestWithoutExercise).toEqual(["fitos:x"]);
    expect(coverageProblems(report)).toBeGreaterThan(0);
  });

  it("URL: exige 200, image/webp e bytes WebP", async () => {
    const respond = (status: number, type: string, body: Uint8Array | string) => (async () => new Response(body as BodyInit, { status, headers: { "Content-Type": type } })) as unknown as typeof fetch;
    expect(isWebp(webp)).toBe(true);
    expect((await checkImageUrl("u", respond(200, "image/webp", webp))).ok).toBe(true);
    expect(await checkImageUrl("u", respond(404, "text/html", "x"))).toMatchObject({ ok: false, reason: "HTTP 404" });
    expect(await checkImageUrl("u", respond(200, "text/html", "<html>"))).toMatchObject({ ok: false, reason: "Content-Type text/html" });
    expect(await checkImageUrl("u", respond(200, "image/webp", "<html>"))).toMatchObject({ ok: false, reason: "conteúdo não é WebP" });
    expect(await checkImageUrl("u", respond(302, "text/html", ""))).toMatchObject({ ok: false, reason: "HTTP 302" });
  });
});
