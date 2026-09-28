-- AlterTable
ALTER TABLE "saas_subscriptions" ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialUsedAt" TIMESTAMP(3);
