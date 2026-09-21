-- CreateEnum
CREATE TYPE "CatalogImportEnvironment" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "CatalogImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "catalog_import_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'API_NINJAS',
    "environment" "CatalogImportEnvironment" NOT NULL,
    "status" "CatalogImportStatus" NOT NULL DEFAULT 'PENDING',
    "importerVersion" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "ignored" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "executor" TEXT,
    "forceReimportNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_import_runs_provider_environment_idx" ON "catalog_import_runs"("provider", "environment");

-- IMP-EX-001: trava real de concorrência e de segunda carga. Não expressável
-- em schema.prisma (índice parcial) — adicionado à mão, mesmo padrão dos
-- TRIGGERs de tenant já existentes neste projeto (ver
-- 20260916000000_add_tenant_composite_constraints). Sem esta dupla de
-- índices, duas execuções concorrentes do job poderiam ambas passar pela
-- checagem em `catalogImportRun.ts` antes de qualquer uma escrever
-- `RUNNING`; o índice é a garantia atômica, a checagem em código é só a
-- mensagem de erro amigável.
CREATE UNIQUE INDEX "catalog_import_runs_running_lock"
    ON "catalog_import_runs"("provider", "environment")
    WHERE "status" = 'RUNNING';

CREATE UNIQUE INDEX "catalog_import_runs_completed_lock"
    ON "catalog_import_runs"("provider", "environment")
    WHERE "status" = 'COMPLETED';
