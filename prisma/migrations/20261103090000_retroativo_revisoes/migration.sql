-- Treino retroativo (feature 2, parte 2): trilha da versão anterior de treinos
-- editados ou excluídos, e resultado congelado dos períodos encerrados.

-- AlterTable
ALTER TABLE "period_goals" ADD COLUMN     "finalTenths" INTEGER,
ADD COLUMN     "finalizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "workout_session_revisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "pointsTenthsBefore" INTEGER,
    "pointsStatusBefore" TEXT,
    "pointsTenthsAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_session_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_session_revisions_tenantId_sessionId_idx" ON "workout_session_revisions"("tenantId", "sessionId");

-- AddForeignKey
ALTER TABLE "workout_session_revisions" ADD CONSTRAINT "workout_session_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

