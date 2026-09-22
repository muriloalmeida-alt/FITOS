// @vitest-environment node
//
// Testes de integração da importação do catálogo curado FITOS em PT-BR
// (IMP-EX-002) contra PostgreSQL real (banco de testes). O parsing do CSV
// não toca a rede nem o disco do repositório — cada teste monta o conteúdo
// do CSV como string literal, para não depender do arquivo versionado.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  CuratedCatalogRowError,
  importCuratedCatalog,
  mapCuratedCatalogRows,
  parseCuratedCatalogCsv,
} from "./importCuratedCatalog";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { externalId: { contains: run } } });
  await prisma.$disconnect();
});

const CSV_HEADER =
  "canonical_key,name,type,category,category_label,primary_muscle,primary_muscle_label,difficulty,equipments,instructions,safety_info,language,source,active";

function csvRow(overrides: Partial<Record<string, string>> = {}): string {
  const fields = {
    canonical_key: `rosca-direta-${run}`,
    name: `Rosca direta ${run}`,
    type: "strength",
    category: "cables_and_pulleys",
    category_label: "Cabos e polias",
    primary_muscle: "biceps",
    primary_muscle_label: "Bíceps",
    difficulty: "beginner",
    equipments: "barra W|banco",
    instructions: "Flexione os cotovelos...",
    safety_info: "Não balance o tronco.",
    language: "pt-BR",
    source: "fitos-curated",
    active: "true",
    ...overrides,
  };
  const order = CSV_HEADER.split(",");
  return order.map((key) => `"${fields[key as keyof typeof fields] ?? ""}"`).join(",");
}

function csv(...rows: string[]): string {
  return [CSV_HEADER, ...rows].join("\n");
}

describe("parseCuratedCatalogCsv / mapCuratedCatalogRows (IMP-EX-002)", () => {
  it("mapeia os campos do CSV para o formato de persistência, com os rótulos em PT-BR", () => {
    const [record] = parseCuratedCatalogCsv(csv(csvRow()));

    expect(record).toEqual({
      externalId: `rosca-direta-${run}`,
      name: `Rosca direta ${run}`,
      type: "Cabos e polias",
      muscle: "Bíceps",
      equipments: "barra W, banco",
      difficulty: "beginner",
      instructions: "Flexione os cotovelos...",
      safetyInfo: "Não balance o tronco.",
      active: true,
    });
  });

  it("active=false é mapeado para false (não para arquivamento aqui — isso é responsabilidade do upsert)", () => {
    const [record] = parseCuratedCatalogCsv(csv(csvRow({ active: "false" })));
    expect(record?.active).toBe(false);
  });

  it("equipments vazio é mapeado para null, não string vazia", () => {
    const [record] = parseCuratedCatalogCsv(csv(csvRow({ equipments: "" })));
    expect(record?.equipments).toBeNull();
  });

  it("linha sem canonical_key: lança CuratedCatalogRowError com o número da linha", () => {
    expect(() => mapCuratedCatalogRows([{ ...rawRow(), canonical_key: "" }])).toThrow(CuratedCatalogRowError);
    try {
      mapCuratedCatalogRows([{ ...rawRow(), canonical_key: "" }]);
    } catch (error) {
      expect(error).toBeInstanceOf(CuratedCatalogRowError);
      expect((error as CuratedCatalogRowError).message).toContain("Linha 2");
    }
  });

  it("linha sem name: lança CuratedCatalogRowError", () => {
    expect(() => mapCuratedCatalogRows([{ ...rawRow(), name: "  " }])).toThrow(CuratedCatalogRowError);
  });
});

function rawRow() {
  return {
    canonical_key: `x-${run}`,
    name: `X ${run}`,
    type: "strength",
    category: "c",
    category_label: "Categoria",
    primary_muscle: "m",
    primary_muscle_label: "Músculo",
    difficulty: "beginner",
    equipments: "",
    instructions: "",
    safety_info: "",
    language: "pt-BR",
    source: "fitos-curated",
    active: "true",
  };
}

describe("importCuratedCatalog (IMP-EX-002)", () => {
  it("importa um exercício novo: cria com tenantId nulo, origin FITOS_CURATED, status ATIVO", async () => {
    const records = parseCuratedCatalogCsv(csv(csvRow({ canonical_key: `novo-${run}`, name: `Novo ${run}` })));

    const result = await importCuratedCatalog(records, prisma);

    expect(result).toEqual({ total: 1, created: 1, updated: 0 });

    const stored = await prisma.exercise.findFirstOrThrow({
      where: { origin: "FITOS_CURATED", externalId: `novo-${run}` },
    });
    expect(stored.tenantId).toBeNull();
    expect(stored.name).toBe(`Novo ${run}`);
    expect(stored.status).toBe("ATIVO");
  });

  it("active=false: status ARQUIVADO", async () => {
    const records = parseCuratedCatalogCsv(
      csv(csvRow({ canonical_key: `inativo-${run}`, name: `Inativo ${run}`, active: "false" }))
    );

    await importCuratedCatalog(records, prisma);

    const stored = await prisma.exercise.findFirstOrThrow({
      where: { origin: "FITOS_CURATED", externalId: `inativo-${run}` },
    });
    expect(stored.status).toBe("ARQUIVADO");
  });

  it("reimportação do mesmo externalId: não duplica, atualiza os dados (idempotente)", async () => {
    const original = parseCuratedCatalogCsv(
      csv(csvRow({ canonical_key: `reimport-${run}`, name: `Reimport ${run}`, difficulty: "beginner" }))
    );
    await importCuratedCatalog(original, prisma);

    const updated = parseCuratedCatalogCsv(
      csv(csvRow({ canonical_key: `reimport-${run}`, name: `Reimport ${run}`, difficulty: "advanced" }))
    );
    const secondResult = await importCuratedCatalog(updated, prisma);

    expect(secondResult).toEqual({ total: 1, created: 0, updated: 1 });

    const rows = await prisma.exercise.findMany({ where: { origin: "FITOS_CURATED", externalId: `reimport-${run}` } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.difficulty).toBe("advanced");
  });

  it("nunca cria com origin diferente de FITOS_CURATED nem tenantId preenchido", async () => {
    const records = parseCuratedCatalogCsv(csv(csvRow({ canonical_key: `origem-${run}`, name: `Origem ${run}` })));
    await importCuratedCatalog(records, prisma);

    const stored = await prisma.exercise.findFirstOrThrow({ where: { externalId: `origem-${run}` } });
    expect(stored.origin).toBe("FITOS_CURATED");
    expect(stored.tenantId).toBeNull();
  });

  it("múltiplos registros: contagens agregadas corretas (criação e atualização misturadas)", async () => {
    const first = parseCuratedCatalogCsv(csv(csvRow({ canonical_key: `multi-a-${run}`, name: `Multi A ${run}` })));
    await importCuratedCatalog(first, prisma);

    const batch = parseCuratedCatalogCsv(
      csv(
        csvRow({ canonical_key: `multi-a-${run}`, name: `Multi A ${run}`, difficulty: "advanced" }),
        csvRow({ canonical_key: `multi-b-${run}`, name: `Multi B ${run}` })
      )
    );
    const result = await importCuratedCatalog(batch, prisma);

    expect(result).toEqual({ total: 2, created: 1, updated: 1 });
  });
});
