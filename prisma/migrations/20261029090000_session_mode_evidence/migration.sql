-- CreateEnum
CREATE TYPE "WorkoutSessionMode" AS ENUM ('LIVE', 'RETROATIVO');

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "declaredDurationSeconds" INTEGER,
ADD COLUMN     "mode" "WorkoutSessionMode" NOT NULL DEFAULT 'LIVE',
ADD COLUMN     "operationKey" TEXT,
ADD COLUMN     "performedAt" TIMESTAMP(3),
ADD COLUMN     "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "workout_evidence_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_evidence_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_evidence_photos_tenantId_idx" ON "workout_evidence_photos"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_evidence_photos_sessionId_sha256_key" ON "workout_evidence_photos"("sessionId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_operationKey_key" ON "workout_sessions"("operationKey");

-- AddForeignKey
ALTER TABLE "workout_evidence_photos" ADD CONSTRAINT "workout_evidence_photos_sessionId_tenantId_fkey" FOREIGN KEY ("sessionId", "tenantId") REFERENCES "workout_sessions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Treinos já existentes: registrados quando começaram.
UPDATE "workout_sessions" SET "recordedAt" = "startedAt";

-- Duração declarada sempre positiva (até 24 h); retroativo sempre com data da realização.
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_declared_duration_check" CHECK ("declaredDurationSeconds" IS NULL OR ("declaredDurationSeconds" > 0 AND "declaredDurationSeconds" <= 86400));
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_retroativo_performed_check" CHECK ("mode" <> 'RETROATIVO' OR "performedAt" IS NOT NULL);
