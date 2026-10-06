-- AlterTable
ALTER TABLE "students" ADD COLUMN     "referredByStudentId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "personal_referrals" (
    "id" TEXT NOT NULL,
    "referrerTenantId" TEXT NOT NULL,
    "referredTenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),

    CONSTRAINT "personal_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_referrals_referredTenantId_key" ON "personal_referrals"("referredTenantId");

-- CreateIndex
CREATE INDEX "personal_referrals_referrerTenantId_idx" ON "personal_referrals"("referrerTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_referralCode_key" ON "tenants"("referralCode");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_referredByStudentId_fkey" FOREIGN KEY ("referredByStudentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_referrals" ADD CONSTRAINT "personal_referrals_referrerTenantId_fkey" FOREIGN KEY ("referrerTenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_referrals" ADD CONSTRAINT "personal_referrals_referredTenantId_fkey" FOREIGN KEY ("referredTenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

