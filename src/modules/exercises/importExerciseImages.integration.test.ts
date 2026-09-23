// @vitest-environment node
//
// Testes de integração do vínculo de imagens ilustradas (FIT-111 + migração
// R2) contra PostgreSQL real. Nunca lê disco nem rede real: `readImageFile`
// e `uploadImage` são sempre stubs em memória — o conteúdo do arquivo físico
// e o storage real não importam para estas regras, só o comportamento do
// módulo diante deles.
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  createPublicDirImageReader,
  importExerciseImages,
  parseExerciseImageManifest,
  revertExerciseImages,
  validateExerciseImageManifest,
  ExerciseImageManifestError,
  type BuildImageUrl,
  type ExerciseImageManifestEntry,
  type ReadImageFile,
  type UploadImage,
} from "./importExerciseImages";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { externalId: { contains: run } } });
  await prisma.$disconnect();
});

function fakeReader(content: Record<string, string>): ReadImageFile {
  return async (slug: string) => {
    if (!(slug in content)) {
      throw new Error(`arquivo não encontrado para o slug "${slug}"`);
    }
    return { buffer: Buffer.from(content[slug] as string, "utf-8"), extension: "webp", contentType: "image/webp" };
  };
}

const fakeBuildImageUrl: BuildImageUrl = (objectKey) => `https://media.fitos.test/${objectKey}`;

function okUploader(): UploadImage {
  return vi.fn(async () => {});
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

describe("validateExerciseImageManifest", () => {
  it("aceita um manifesto com chaves e slugs únicos", () => {
    expect(() => validateExerciseImageManifest([entry({ canonicalKey: "a", slug: "a" }), entry({ canonicalKey: "b", slug: "b" })])).not.toThrow();
  });

  it("rejeita canonicalKey duplicada", () => {
    expect(() =>
      validateExerciseImageManifest([entry({ canonicalKey: "dup", slug: "a" }), entry({ canonicalKey: "dup", slug: "b" })])
    ).toThrow(/canonicalKey duplicada/);
  });

  it("rejeita slug duplicado", () => {
    expect(() =>
      validateExerciseImageManifest([entry({ canonicalKey: "a", slug: "dup" }), entry({ canonicalKey: "b", slug: "dup" })])
    ).toThrow(/slug duplicado/);
  });

  it("rejeita entrada com altText vazio", () => {
    expect(() => validateExerciseImageManifest([entry({ altText: "" })])).toThrow(/altText vazio/);
  });
});

describe("importExerciseImages (FIT-111 + R2)", () => {
  it("vincula a imagem a um Exercise FITOS_CURATED já existente (primeira vez: importado)", async () => {
    const externalId = `fitos:vinculo-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Vínculo ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `vinculo-${run}` });
    const uploadImage = okUploader();

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage },
      prisma
    );

    expect(result).toMatchObject({ total: 1, importados: 1, atualizados: 0, ignorados: 0, falhos: 0, simulados: 0 });
    expect(uploadImage).toHaveBeenCalledWith({
      key: `exercises/vinculo-${run}.webp`,
      body: Buffer.from("conteudo", "utf-8"),
      contentType: "image/webp",
    });

    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBe(`https://media.fitos.test/exercises/vinculo-${run}.webp`);
    expect(stored.imageAlt).toBe(manifestEntry.altText);
  });

  it("reexecução sem nenhuma mudança: idempotente (ignorado, nunca chama upload de novo)", async () => {
    const externalId = `fitos:idempotente-${run}`;
    await seedCuratedExercise(externalId, `Idempotente ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `idempotente-${run}` });
    const readImageFile = fakeReader({ [manifestEntry.slug]: "conteudo" });

    await importExerciseImages([manifestEntry], { readImageFile, buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() }, prisma);
    const secondUploadImage = okUploader();
    const second = await importExerciseImages(
      [manifestEntry],
      { readImageFile, buildImageUrl: fakeBuildImageUrl, uploadImage: secondUploadImage },
      prisma
    );

    expect(second).toMatchObject({ total: 1, importados: 0, atualizados: 0, ignorados: 1, falhos: 0 });
    expect(secondUploadImage).not.toHaveBeenCalled();
  });

  it("altText alterado no manifesto: segunda execução atualiza (não duplica) e reenvia o upload", async () => {
    const externalId = `fitos:atualiza-${run}`;
    await seedCuratedExercise(externalId, `Atualiza ${run}`);
    const first = entry({ canonicalKey: externalId, slug: `atualiza-${run}`, altText: "Texto original." });
    const readImageFile = fakeReader({ [first.slug]: "conteudo" });
    await importExerciseImages([first], { readImageFile, buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() }, prisma);

    const revised = { ...first, altText: "Texto revisado com mais detalhe funcional." };
    const uploadImage = okUploader();
    const result = await importExerciseImages([revised], { readImageFile, buildImageUrl: fakeBuildImageUrl, uploadImage }, prisma);

    expect(result).toMatchObject({ total: 1, importados: 0, atualizados: 1, ignorados: 0 });
    expect(uploadImage).toHaveBeenCalledOnce();
    const rows = await prisma.exercise.findMany({ where: { origin: "FITOS_CURATED", externalId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.imageAlt).toBe("Texto revisado com mais detalhe funcional.");
  });

  it("canonicalKey sem Exercise correspondente: falho, sem lançar e sem criar exercício novo", async () => {
    const manifestEntry = entry({ canonicalKey: `fitos:inexistente-${run}`, slug: `inexistente-${run}` });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() },
      prisma
    );

    expect(result).toMatchObject({ total: 1, importados: 0, falhos: 1 });
    expect(result.outcomes[0]?.reason).toContain("FITOS_CURATED");

    const count = await prisma.exercise.count({ where: { externalId: `fitos:inexistente-${run}` } });
    expect(count).toBe(0);
  });

  it("exercício de mesma externalId mas origin PERSONAL nunca é encontrado/alterado", async () => {
    const externalId = `fitos:origem-errada-${run}`;
    const personalExercise = await prisma.exercise.create({
      data: { origin: "PERSONAL", tenantId: null, externalId, name: `Pessoal ${run}`, status: "ATIVO" },
    });
    const manifestEntry = entry({ canonicalKey: externalId, slug: `origem-errada-${run}` });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() },
      prisma
    );

    expect(result).toMatchObject({ falhos: 1, importados: 0 });
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: personalExercise.id } });
    expect(stored.imageUrl).toBeNull();
  });

  it("dry-run nunca chama uploadImage nem grava no banco", async () => {
    const externalId = `fitos:dryrun-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Dry-run ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `dryrun-${run}` });
    const uploadImage = okUploader();

    const result = await importExerciseImages(
      [manifestEntry],
      { dryRun: true, readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage },
      prisma
    );

    expect(result).toMatchObject({ total: 1, simulados: 1, importados: 0 });
    expect(uploadImage).not.toHaveBeenCalled();
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBeNull();
  });

  it("falha de upload: falho, e o banco não é atualizado", async () => {
    const externalId = `fitos:upload-falha-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Upload falha ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `upload-falha-${run}` });
    const uploadImage: UploadImage = vi.fn(async () => {
      throw new Error("PutObject falhou: credenciais inválidas.");
    });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage },
      prisma
    );

    expect(result).toMatchObject({ falhos: 1, importados: 0, atualizados: 0 });
    expect(result.outcomes[0]?.reason).toContain("PutObject falhou");
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBeNull();
  });

  it("falha na confirmação do objeto (HeadObject divergente): falho, e o banco não é atualizado", async () => {
    const externalId = `fitos:confirmacao-falha-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Confirmação falha ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `confirmacao-falha-${run}` });
    const uploadImage: UploadImage = vi.fn(async () => {
      throw new Error('Confirmação do objeto "exercises/x.webp" falhou: tamanho gravado (0) difere do esperado (9).');
    });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage },
      prisma
    );

    expect(result).toMatchObject({ falhos: 1 });
    expect(result.outcomes[0]?.reason).toContain("Confirmação do objeto");
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
      { readImageFile: fakeReader({ [okEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() },
      prisma
    );

    expect(result).toMatchObject({ total: 2, importados: 1, falhos: 1 });
  });

  it("reason de falha nunca contém segredo — só a mensagem de erro do upload/config, nunca uma credencial", async () => {
    const externalId = `fitos:sem-segredo-${run}`;
    await seedCuratedExercise(externalId, `Sem segredo ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `sem-segredo-${run}` });
    const segredoQueNuncaDeveApareceNoLog = "r2-secret-jamais-exposto";
    const uploadImage: UploadImage = vi.fn(async () => {
      throw new Error("Falha de autenticação ao enviar objeto (variável de ambiente ausente ou inválida).");
    });

    const result = await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "conteudo" }), buildImageUrl: fakeBuildImageUrl, uploadImage },
      prisma
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(segredoQueNuncaDeveApareceNoLog);
  });
});

describe("createPublicDirImageReader", () => {
  it("lança ExerciseImageAssetError (não um erro genérico de I/O) quando nenhum arquivo existe para o slug", async () => {
    const reader = createPublicDirImageReader("/tmp/diretorio-inexistente-fitos-teste");
    await expect(reader(`slug-inexistente-${run}`)).rejects.toThrow(/Nenhum arquivo de imagem encontrado/);
  });
});

describe("revertExerciseImages (FIT-111)", () => {
  it("limpa imageUrl/imageAlt do Exercise sem apagar o registro nem tocar objetos do bucket", async () => {
    const externalId = `fitos:revert-${run}`;
    const exercise = await seedCuratedExercise(externalId, `Revert ${run}`);
    const manifestEntry = entry({ canonicalKey: externalId, slug: `revert-${run}` });
    await importExerciseImages(
      [manifestEntry],
      { readImageFile: fakeReader({ [manifestEntry.slug]: "x" }), buildImageUrl: fakeBuildImageUrl, uploadImage: okUploader() },
      prisma
    );

    const result = await revertExerciseImages([manifestEntry], prisma);

    expect(result.revertidos).toBe(1);
    const stored = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    expect(stored.imageUrl).toBeNull();
    expect(stored.imageAlt).toBeNull();
    expect(stored.name).toBe(`Revert ${run}`);
  });

  it("rollback restrito ao manifesto informado: exercício fora do manifesto não é afetado", async () => {
    const inManifestId = `fitos:revert-restrito-in-${run}`;
    const outOfManifestId = `fitos:revert-restrito-out-${run}`;
    const inManifest = await seedCuratedExercise(inManifestId, `Dentro do manifesto ${run}`);
    const outOfManifest = await seedCuratedExercise(outOfManifestId, `Fora do manifesto ${run}`);
    const manifestEntry = entry({ canonicalKey: inManifestId, slug: `revert-restrito-${run}` });
    const outsideEntry = entry({ canonicalKey: outOfManifestId, slug: `revert-restrito-out-${run}` });

    await importExerciseImages(
      [manifestEntry, outsideEntry],
      {
        readImageFile: fakeReader({ [manifestEntry.slug]: "x", [outsideEntry.slug]: "y" }),
        buildImageUrl: fakeBuildImageUrl,
        uploadImage: okUploader(),
      },
      prisma
    );

    await revertExerciseImages([manifestEntry], prisma);

    const stillLinked = await prisma.exercise.findUniqueOrThrow({ where: { id: outOfManifest.id } });
    const reverted = await prisma.exercise.findUniqueOrThrow({ where: { id: inManifest.id } });
    expect(reverted.imageUrl).toBeNull();
    expect(stillLinked.imageUrl).not.toBeNull();
  });
});
