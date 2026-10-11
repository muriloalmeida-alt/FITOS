-- CreateEnum
CREATE TYPE "AccessGrantState" AS ENUM ('ACTIVE', 'SYNCING', 'FAILED', 'REVOKED');

-- CreateTable
CREATE TABLE "administrative_access_grants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "actorAdminId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT,
    "state" "AccessGrantState" NOT NULL DEFAULT 'ACTIVE',
    "operationKey" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administrative_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_benefit_audits" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_benefit_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administrative_access_grants_operationKey_key" ON "administrative_access_grants"("operationKey");

-- CreateIndex
CREATE INDEX "administrative_access_grants_tenantId_state_endsAt_idx" ON "administrative_access_grants"("tenantId", "state", "endsAt");

-- CreateIndex
CREATE INDEX "administrative_access_grants_subscriptionId_idx" ON "administrative_access_grants"("subscriptionId");

-- CreateIndex
CREATE INDEX "admin_benefit_audits_tenantId_occurredAt_idx" ON "admin_benefit_audits"("tenantId", "occurredAt");

-- AddForeignKey
ALTER TABLE "administrative_access_grants" ADD CONSTRAINT "administrative_access_grants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrative_access_grants" ADD CONSTRAINT "administrative_access_grants_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

