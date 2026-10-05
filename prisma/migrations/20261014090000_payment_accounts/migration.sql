-- AlterTable
ALTER TABLE "student_charges" ADD COLUMN     "externalPaymentId" TEXT,
ADD COLUMN     "paymentUrl" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "cpf" TEXT;

-- CreateTable
CREATE TABLE "payment_accounts" (
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "webhookId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_webhookToken_key" ON "payment_accounts"("webhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "student_charges_externalPaymentId_key" ON "student_charges"("externalPaymentId");

-- AddForeignKey
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

