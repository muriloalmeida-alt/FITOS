-- CreateEnum
CREATE TYPE "PersonalStudentRangeEstimate" AS ENUM ('COMECANDO_AGORA', 'ATE_20', 'DE_21_A_50', 'MAIS_DE_50');

-- CreateTable
CREATE TABLE "personal_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cref" TEXT,
    "studentRangeEstimate" "PersonalStudentRangeEstimate" NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_profiles_tenantId_key" ON "personal_profiles"("tenantId");

-- AddForeignKey
ALTER TABLE "personal_profiles" ADD CONSTRAINT "personal_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
