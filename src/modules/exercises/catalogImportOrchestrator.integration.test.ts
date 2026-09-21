// @vitest-environment node
//
// Testes de integração da orquestração (IMP-EX-001) contra PostgreSQL real
// — `searchExercises` é substituído por fixtures locais (mesmo padrão de
// `importExercises.integration.test.ts`); nenhum destes testes toca a rede
// real ou a API Ninjas.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";

const searchExercisesMock = vi.fn();
vi.mock("@/integrations/api-ninjas", async () => {
  const actual = await vi.importActual<typeof import("@/integrations/api-ninjas")>("@/integrations/api-ninjas");
  return { ...actual, searchExercises: (...args: [unknown, unknown]) => searchExercisesMock(...args) };
});

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeEach(async () => {
  vi.resetAllMocks();
  await prisma.catalogImportRun.deleteMany({});
});

afterAll(async () => {
  await prisma.catalogImportRun.deleteMany({});
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.$disconnect();
});

describe("runCatalogImportDryRun (IMP-EX-001)", () => {
  it("não grava nenhuma linha em CatalogImportRun nem em Exercise", async () => {
    searchExercisesMock.mockResolvedValue([{ name: `Dry-run ${run}`, type: null, muscle: null, equipments: null, difficulty: null, instructions: null, safetyInfo: null }]);

    const { runCatalogImportDryRun } = await import("./catalogImportOrchestrator");
    const report = await runCatalogImportDryRun();

    expect(report.queries).toBe(10);
    expect(report.received).toBe(10);
    expect(report.valid).toBe(10);
    expect(report.failedSearches).toBe(0);

    expect(await prisma.catalogImportRun.count()).toBe(0);
    expect(await prisma.exercise.findFirst({ where: { name: `Dry-run ${run}` } })).toBeNull();
  });

  it("conta buscas falhadas sem lançar erro", async () => {
    searchExercisesMock.mockRejectedValue(new Error("falha simulada"));

    const { runCatalogImportDryRun } = await import("./catalogImportOrchestrator");
    const report = await runCatalogImportDryRun();

    expect(report.failedSearches).toBe(10);
    expect(report.received).toBe(0);
  });
});

describe("runCatalogImport (IMP-EX-001)", () => {
  it("processa o manifesto inteiro, grava os exercícios e conclui como COMPLETED", async () => {
    searchExercisesMock.mockImplementation(async (input: { muscle?: string }) => [
      { name: `${run} ${input.muscle}`, type: "strength", muscle: input.muscle ?? null, equipments: null, difficulty: null, instructions: null, safetyInfo: null },
    ]);

    const { runCatalogImport } = await import("./catalogImportOrchestrator");
    const summary = await runCatalogImport({ environment: "HOMOLOGACAO", autorizadoPor: "Teste Automatizado" }, prisma);

    expect(summary.resumedFromCheckpoint).toBe(0);
    expect(summary.inserted).toBe(10);
    expect(summary.received).toBe(10);

    const stored = await prisma.catalogImportRun.findUniqueOrThrow({ where: { id: summary.runId } });
    expect(stored.status).toBe("COMPLETED");
    expect(stored.checkpoint).toBe(10);

    const exercises = await prisma.exercise.findMany({ where: { name: { startsWith: `${run} ` } } });
    expect(exercises).toHaveLength(10);
  });

  it("uma segunda chamada após COMPLETED é recusada (mesma trava usada pelo comando/rota)", async () => {
    searchExercisesMock.mockResolvedValue([]);
    const { runCatalogImport } = await import("./catalogImportOrchestrator");
    const { CatalogImportAlreadyCompletedError } = await import("./catalogImportRun");

    await runCatalogImport({ environment: "PRODUCAO", autorizadoPor: "Teste Automatizado" }, prisma);

    await expect(runCatalogImport({ environment: "PRODUCAO", autorizadoPor: "Teste Automatizado" }, prisma)).rejects.toBeInstanceOf(
      CatalogImportAlreadyCompletedError
    );
  });
});
