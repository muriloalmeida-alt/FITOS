-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "saas_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "externalSubscriptionId" TEXT,
    "valueCents" INTEGER,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "lastEvent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_versions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "products" "TenantType"[],
    "segments" TEXT[],
    "planIds" TEXT[],
    "cycles" "BillingCycle"[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "durationCycles" INTEGER NOT NULL,
    "maxRedemptions" INTEGER,
    "perAccountLimit" INTEGER NOT NULL DEFAULT 1,
    "budgetCents" INTEGER,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_audience_members" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "selectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_audience_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_audit" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_payments_externalPaymentId_key" ON "saas_payments"("externalPaymentId");

-- CreateIndex
CREATE INDEX "saas_payments_tenantId_status_idx" ON "saas_payments"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_currentVersionId_key" ON "coupons"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_versions_couponId_version_key" ON "coupon_versions"("couponId", "version");

-- CreateIndex
CREATE INDEX "coupon_audience_members_tenantId_idx" ON "coupon_audience_members"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_audience_members_versionId_tenantId_key" ON "coupon_audience_members"("versionId", "tenantId");

-- CreateIndex
CREATE INDEX "coupon_audit_couponId_occurredAt_idx" ON "coupon_audit"("couponId", "occurredAt");

-- AddForeignKey
ALTER TABLE "saas_payments" ADD CONSTRAINT "saas_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "coupon_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_versions" ADD CONSTRAINT "coupon_versions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_audience_members" ADD CONSTRAINT "coupon_audience_members_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "coupon_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_audience_members" ADD CONSTRAINT "coupon_audience_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_audit" ADD CONSTRAINT "coupon_audit_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras que o banco garante (ADR-021).
ALTER TABLE "coupon_versions" ADD CONSTRAINT "coupon_versions_values_check" CHECK ("amount" > 0 AND ("kind" <> 'PERCENT' OR "amount" <= 10000) AND "durationCycles" IN (1, 2, 3, 6, 12) AND "perAccountLimit" >= 1 AND ("maxRedemptions" IS NULL OR "maxRedemptions" > 0) AND ("budgetCents" IS NULL OR "budgetCents" > 0) AND ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt"));
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_code_check" CHECK ("code" ~ '^[A-Z0-9-]{3,32}$');
