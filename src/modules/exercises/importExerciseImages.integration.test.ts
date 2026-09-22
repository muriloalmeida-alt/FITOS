// @vitest-environment node
//
// Testes de integração do vínculo de imagens ilustradas (FIT-111) contra
// PostgreSQL real. Nunca lê disco: `readImageFile` é sempre um stub em
// memória — o conteúdo do arquivo físico não importa para estas regras,
// só o texto do buffer usado no checksum.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  buildExerciseImageUrl,
  importExerciseImages,
  parseExerciseImageManifest,
  revertExerciseImages,
  ExerciseImageManifestError,
  type ExerciseImageManifestEntry,
} from "./importExerciseImages";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { externalId: { contains: run } } });
  await prisma.$disconnect();
});

function fakeReader(content: Record<string, string>): (slug: string) => Promise<Buffer> {
  return async (slug: string) => {
    if (!(slug in content)) {
      throw new Error(`arquivo não encontrado para o slug "${slug}"`);
    }
    return Buffer.from(content[slug] as string, "utf-8");
  };
}

function entry(overrides: Partial<ExerciseImageManifestEntry> = {}): ExerciseImageManifestEntry {
  return {
    arquivoOriginal: `Exercicio ${run}.png`,
    canonicalKey: `fitos:exercicio-${run}`,
    slug: `exercicio-${run}`,
    nomeCanonico: `Exercício ${run}`,
    musculo: "Peito",
    equipamento: "barra",
    aliases: [`Exercicio ${run}`],
    duasFases: false,
    altText: `Exercício ${run}. Ilustração da execução do movimento.`,
    width: 800,
    height: 800,
    ...overrides,
  };
}

async function seedCuratedExercise(externalId: string, name: string) {
  return prisma.exercise.create({
    data: { origin: "FITOS_CURATED", tenantId: null, externalId, name, status: "ATIVO" },
  });
}

describe("parseExerciseImageManifest", () => {
  it("lança ExerciseImageManifestError para JSON inválido", () => {
    expect(() => parseExerciseImageManifest("{ isso não é uma lista")).toThrow(ExerciseImageManifestError);
  });

  it("lança ExerciseImageManifestError quando o conteúdo não é uma lista", () => {
    expect(() => parseExerciseImageManifest('{"a": 1}')).toThrow(ExerciseImageManifestError);
  });

  it("aceita uma lista válida", () => {
    const parsed = parseExerciseImageManifest(JSON.stringify([entry()]));
    expect(parsed).toHaveLength(1);
  });
});

describe("buildExerciseImageUrl", () => {
  it("gera um caminho público estático, nunca um bucket/URL assinada", () => {
    expect(buildExerciseImageUrl("agachamento-livre")).toBe("/media/exercises/agachamento-livre.webp");
  });
});

describe("importExerciseImages (FIT-111)", () => {
  it("vincula a imagem a um Exercise FITOS_CURATED já existente (primeira vez: importado)", async () => {
    const externalId = `fitos:vinculo-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Vínculo ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `vinculo-${run}` });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }) },
      prisma
    );

    expect(result).toMatchObject({ total: 1, importados: 1, atualizados: 0, ignorados: 0, falhos: 0, simulados: 0 });

    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBe(`/media/exercises/vinculo-${run}.webp`);
    expect(stored.imageAlt).toBe(manifestEntry.altText);
  });

  it("reexecução sem nenhuma mudança: idempotente (ignorado, não regrava)", async () => {
    const externalId = `fitos:idempotente-${run}`;
    await seedCuratedExercise(externalId, `Idempotente ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `idempotente-${run}` });
    const readImageFile = fakeReader({ [manifestEntry.slug]: "conteudo" });

    await importExerciseImages([manifestEntry], { readImageFile }, prisma);
    const second = await importExerciseImages([manifestEntry], { readImageFile }, prisma);

    expect(second).toMatchObject({ total: 1, importados: 0, atualizados: 0, ignorados: 1, falhos: 0 });
  });

  it("altText alterado no manifesto: segunda execução atualiza (não duplica)", async () => {
    const externalId = `fitos:atualiza-${run}`;
    await seedCuratedExercise(externalId, `Atualiza ${run}`);
    const first = entry({ canonicalKey: externalId, slug: `atualiza-${run}`, altText: "Texto original." });
    const readImageFile = fakeReader({ [first.slug]: "conteudo" });
    await importExerciseImages([first], { readImageFile }, prisma);

    const revised = { ...first, altText: "Texto revisado com mais detalhe funcional." };
    const result = await importExerciseImages([revised], { readImageFile }, prisma);

    expect(result).toMatchObject({ total: 1, importados: 0, atualizados: 1, ignorados: 0 });
    const rows = await prisma.exercise.findMany({ where: { origin: "FITOS_CURATED", externalId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.imageAlt).toBe("Texto revisado com mais detalhe funcional.");
  });

  it("canonicalKey sem Exercise correspondente: falho, sem lançar e sem criar exercício novo", async () => {
    const manifestEntry = entry({ canonicalKey: `fitos:inexistente-${run}`, slug: `inexistente-${run}` });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }) },
      prisma
    );

    expect(result).toMatchObject({ total: 1, importados: 0, falhos: 1 });
    expect(result.outcomes[0]?.reason).toContain("FITOS_CURATED");

    const count = await prisma.exercise.count({ where: { externalId: `fitos:inexistente-${run}` } });
    expect(count).toBe(0);
  });

  it("dry-run nunca grava: simulado, mas o Exercise permanece sem imagem", async () => {
    const externalId = `fitos:dryrun-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Dry-run ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `dryrun-${run}` });

    const result = await importExerciseImages(
      [manifestEntry],
      { dryRun: true, readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }) },
      prisma
    );

    expect(result).toMatchObject({ total: 1, simulados: 1, importados: 0 });
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBeNull();
  });

  it("falha isolada de um item (arquivo ausente) não impede o processamento dos demais do lote", async () => {
    const okExternalId = `fitos:lote-ok-${run}`;
    const badExternalId = `fitos:lote-falho-${run}`;
    await seedCuratedExercise(okExternalId, `Lote OK ${run}`);
    await seedCuratedExercise(badExternalId, `Lote falho ${run}`);

    const okEntry = entry({ canonicalKey: okExternalId, slug: `lote-ok-${run}` });
    const badEntry = entry({ canonicalKey: badExternalId, slug: `lote-falho-${run}` });

    const result = await importExerciseImages(
      [okEntry, badEntry],
      { readImageFile: fakeReader({ [okEntry.slug]: "conteudo" }) },
      prisma
    );

    expect(result).toMatchObject({ total: 2, importados: 1, falhos: 1 });
  });
});

describe("revertExerciseImages (FIT-111)", () => {
  it("limpa imageUrl/imageAlt do Exercise sem apagar o registro", async () => {
    const externalId = `fitos:revert-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Revert ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `revert-${run}` });
    await importExerciseImages([manifestEntry], { readImageFile: fakeReader({ [manifestEntry.slug]: "x" }) }, prisma);

    const result = await revertExerciseImages([manifestEntry], prisma);

    expect(result.revertidos).toBe(1);
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBeNull();
    expect(stored.imageAlt).toBeNull();
    expect(stored.name).toBe(`Revert ${run}`);
  });
});
