-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "alertDaysChanged" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alertInactiveDays" INTEGER DEFAULT 7,
ADD COLUMN     "alertOverdue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alertProgramEnd" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "defaultReps" INTEGER,
ADD COLUMN     "defaultRestSeconds" INTEGER,
ADD COLUMN     "defaultSets" INTEGER;

-- CreateTable
CREATE TABLE "personal_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_alerts_userId_kind_refKey_key" ON "personal_alerts"("userId", "kind", "refKey");

-- AddForeignKey
ALTER TABLE "personal_alerts" ADD CONSTRAINT "personal_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

