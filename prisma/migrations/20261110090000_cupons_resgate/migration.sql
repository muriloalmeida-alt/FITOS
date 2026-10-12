-- CreateEnum
CREATE TYPE "CouponRedemptionState" AS ENUM ('COMMITTED', 'ENDED', 'CANCELED');

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "state" "CouponRedemptionState" NOT NULL DEFAULT 'COMMITTED',
    "operationKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "stackable" BOOLEAN NOT NULL,
    "durationCycles" INTEGER NOT NULL,
    "cyclesUsed" INTEGER NOT NULL DEFAULT 0,
    "segment" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "committedBudgetCents" INTEGER NOT NULL,
    "appliedCents" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_operationKey_key" ON "coupon_redemptions"("operationKey");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenantId_state_idx" ON "coupon_redemptions"("tenantId", "state");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_state_idx" ON "coupon_redemptions"("couponId", "state");

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "coupon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras que o banco garante (ADR-021).
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_values_check" CHECK ("amount" > 0 AND "durationCycles" IN (1, 2, 3, 6, 12) AND "cyclesUsed" >= 0 AND "cyclesUsed" <= "durationCycles" AND "baseCents" > 0 AND "discountCents" > 0 AND "discountCents" < "baseCents" AND "committedBudgetCents" >= 0 AND "appliedCents" >= 0);
