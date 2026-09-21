-- CreateEnum
CREATE TYPE "PlanBillingCycle" AS ENUM ('MENSAL', 'ANUAL');

-- CreateTable
CREATE TABLE "commercial_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "billingCycle" "PlanBillingCycle" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "studentLimit" INTEGER NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_plans_code_billingCycle_version_key" ON "commercial_plans"("code", "billingCycle", "version");

-- FIT-090: no máximo uma versão vendável por (code, billingCycle) ao mesmo
-- tempo — mesmo padrão de índice único parcial já usado em
-- catalog_import_runs (não representável em schema.prisma).
CREATE UNIQUE INDEX "commercial_plans_active_code_billing_cycle"
    ON "commercial_plans"("code", "billingCycle")
    WHERE "active" = true;
