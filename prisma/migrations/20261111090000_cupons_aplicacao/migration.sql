-- CreateEnum
CREATE TYPE "CouponApplicationStatus" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "coupon_cycle_applications" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "finalCents" INTEGER NOT NULL,
    "status" "CouponApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "appliedAt" TIMESTAMP(3),
    "countedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_cycle_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_cycle_applications_externalPaymentId_idx" ON "coupon_cycle_applications"("externalPaymentId");

-- CreateIndex
CREATE INDEX "coupon_cycle_applications_status_updatedAt_idx" ON "coupon_cycle_applications"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_cycle_applications_redemptionId_externalPaymentId_key" ON "coupon_cycle_applications"("redemptionId", "externalPaymentId");

-- AddForeignKey
ALTER TABLE "coupon_cycle_applications" ADD CONSTRAINT "coupon_cycle_applications_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "coupon_redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Valores coerentes (ADR-021): o desconto nunca zera a cobrança.
ALTER TABLE "coupon_cycle_applications" ADD CONSTRAINT "coupon_cycle_applications_values_check" CHECK ("baseCents" > 0 AND "discountCents" > 0 AND "finalCents" > 0 AND "attempts" >= 0);
