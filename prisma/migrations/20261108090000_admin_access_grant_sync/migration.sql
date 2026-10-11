-- AlterTable
ALTER TABLE "administrative_access_grants" ADD COLUMN     "previousDueDate" TEXT,
ADD COLUMN     "syncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "targetDueDate" TEXT;

