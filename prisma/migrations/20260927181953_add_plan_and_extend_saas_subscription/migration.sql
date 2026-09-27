-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MENSAL', 'ANUAL');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "audience" "TenantType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "billingCycle" "BillingCycle" NOT NULL,
    "studentLimit" INTEGER,
    "trialDays" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE INDEX "plans_audience_active_idx" ON "plans"("audience", "active");

-- Backfill (FIT-122): a tabela `saas_subscriptions` já existe desde a
-- FIT-007 (reservada, nunca usada por código de aplicação real — só pelo
-- seed sintético e por um teste de isolamento) e pode ter linhas sem
-- `planId`. Antes de tornar a coluna obrigatória, garante um plano
-- PERSONAL de bootstrap (mesmo slug que o catálogo oficial de
-- `src/modules/billing/planCatalog.ts` depois reconcilia por upsert — não
-- uma segunda fonte de verdade) e aponta qualquer assinatura órfã para
-- ele. Nenhuma assinatura real de produção é afetada: nenhum código de
-- aplicação jamais escreveu nesta tabela antes desta História.
INSERT INTO "plans" ("id", "slug", "audience", "name", "billingCycle", "position", "updatedAt")
VALUES ('bootstrap-personal-profissional', 'personal-profissional', 'PERSONAL', 'Profissional', 'MENSAL', 2, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- AlterTable
ALTER TABLE "saas_subscriptions"
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "canceledReason" TEXT,
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "saas_subscriptions"
SET "planId" = (SELECT "id" FROM "plans" WHERE "slug" = 'personal-profissional')
WHERE "planId" IS NULL;

ALTER TABLE "saas_subscriptions" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "saas_subscriptions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "saas_subscriptions_planId_idx" ON "saas_subscriptions"("planId");

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
