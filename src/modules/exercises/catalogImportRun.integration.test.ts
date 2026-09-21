// @vitest-environment node
//
// Testes de integração do ciclo de vida da carga única do catálogo
// (IMP-EX-001) contra PostgreSQL real (banco de testes). Nenhum destes
// testes toca a API Ninjas — só o ciclo de vida de `CatalogImportRun`.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  advanceCatalogImportRun,
  completeCatalogImportRun,
  failCatalogImportRun,
  startCatalogImportRun,
  CatalogImportAlreadyCompletedError,
  CatalogImportLockedError,
  CatalogImportManifestMismatchError,
} from "./catalogImportRun";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

beforeEach(async () => {
  // Tabela exclusiva deste teste (IMP-EX-001) — nenhum outro módulo grava
  // aqui, então limpar a tabela inteira entre testes é seguro e evita
  // colisão entre testes no índice único parcial por (provider, environment)
  // — só duas combinações existem (HOMOLOGACAO/PRODUCAO).
  await prisma.catalogImportRun.deleteMany({});
});

afterAll(async () => {
  await prisma.catalogImportRun.deleteMany({});
  await prisma.$disconnect();
});

const BASE = { importerVersion: "test-v1", manifestHash: "hash-a", executor: "Teste Automatizado" };

describe("startCatalogImportRun (IMP-EX-001)", () => {
  it("cria uma execução nova como RUNNING quando nenhuma existe", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);

    expect(run.status).toBe("RUNNING");
    expect(run.checkpoint).toBe(0);
    expect(run.startedAt).not.toBeNull();
  });

  it("bloqueia uma segunda execução enquanto a primeira está RUNNING", async () => {
    await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);

    await expect(startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma)).rejects.toBeInstanceOf(
      CatalogImportLockedError
    );
  });

  it("duas tentativas concorrentes: exatamente uma inicia, a outra é bloqueada", async () => {
    const results = await Promise.allSettled([
      startCatalogImportRun({ ...BASE, environment: "PRODUCAO" }, prisma),
      startCatalogImportRun({ ...BASE, environment: "PRODUCAO" }, prisma),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(CatalogImportLockedError);
  });

  it("bloqueia nova execução depois de COMPLETED, sem force-reimport", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);
    await completeCatalogImportRun(run.id, prisma);

    await expect(startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma)).rejects.toBeInstanceOf(
      CatalogImportAlreadyCompletedError
    );
  });

  it("com force-reimport e justificativa, cria nova execução mesmo após COMPLETED", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);
    await completeCatalogImportRun(run.id, prisma);

    const forced = await startCatalogImportRun(
      { ...BASE, environment: "HOMOLOGACAO", forceReimportNote: "autorizado por Murilo em 21/09" },
      prisma
    );

    expect(forced.id).not.toBe(run.id);
    expect(forced.status).toBe("RUNNING");
    expect(forced.forceReimportNote).toBe("autorizado por Murilo em 21/09");
  });

  it("retoma a mesma linha (mesmo id, checkpoint preservado) após FAILED com o mesmo manifesto", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);
    await advanceCatalogImportRun(run.id, { checkpoint: 3, received: 5, inserted: 4, updated: 1, ignored: 0, errors: 0 }, prisma);
    await failCatalogImportRun(run.id, prisma);

    const resumed = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);

    expect(resumed.id).toBe(run.id);
    expect(resumed.status).toBe("RUNNING");
    expect(resumed.checkpoint).toBe(3);
    expect(resumed.inserted).toBe(4);
  });

  it("recusa retomar um FAILED com manifesto diferente do informado agora", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO" }, prisma);
    await failCatalogImportRun(run.id, prisma);

    await expect(
      startCatalogImportRun({ ...BASE, environment: "HOMOLOGACAO", manifestHash: "hash-diferente" }, prisma)
    ).rejects.toBeInstanceOf(CatalogImportManifestMismatchError);
  });
});

describe("advanceCatalogImportRun / completeCatalogImportRun / failCatalogImportRun", () => {
  it("soma contadores e avança o checkpoint a cada chamada, sem resetar o acumulado", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "PRODUCAO" }, prisma);

    await advanceCatalogImportRun(run.id, { checkpoint: 1, received: 5, inserted: 3, updated: 2, ignored: 0, errors: 0 }, prisma);
    await advanceCatalogImportRun(run.id, { checkpoint: 2, received: 4, inserted: 4, updated: 0, ignored: 0, errors: 0 }, prisma);

    const updated = await prisma.catalogImportRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(updated.checkpoint).toBe(2);
    expect(updated.received).toBe(9);
    expect(updated.inserted).toBe(7);
    expect(updated.updated).toBe(2);
  });

  it("completeCatalogImportRun grava finishedAt e status COMPLETED", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "PRODUCAO" }, prisma);

    const completed = await completeCatalogImportRun(run.id, prisma);

    expect(completed.status).toBe("COMPLETED");
    expect(completed.finishedAt).not.toBeNull();
  });

  it("failCatalogImportRun grava finishedAt e status FAILED, preservando contadores", async () => {
    const run = await startCatalogImportRun({ ...BASE, environment: "PRODUCAO" }, prisma);
    await advanceCatalogImportRun(run.id, { checkpoint: 1, received: 2, inserted: 2, updated: 0, ignored: 0, errors: 0 }, prisma);

    const failed = await failCatalogImportRun(run.id, prisma);

    expect(failed.status).toBe("FAILED");
    expect(failed.finishedAt).not.toBeNull();
    expect(failed.inserted).toBe(2);
  });
});
