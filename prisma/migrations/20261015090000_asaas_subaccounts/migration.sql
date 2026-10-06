-- AlterTable
ALTER TABLE "payment_accounts" ADD COLUMN     "asaasAccountId" TEXT,
ADD COLUMN     "onboardingUrl" TEXT,
ADD COLUMN     "payoutPixKey" TEXT,
ADD COLUMN     "payoutPixKeyType" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "statusCheckedAt" TIMESTAMP(3),
ADD COLUMN     "walletId" TEXT;

