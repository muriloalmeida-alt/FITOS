-- CreateEnum
CREATE TYPE "ScoringReferenceKind" AS ENUM ('VOLUME', 'REPETICOES', 'TEMPO');

-- CreateEnum
CREATE TYPE "SessionScoreStatus" AS ENUM ('PENDENTE_FOTO', 'LIBERADO', 'CONTESTADO', 'MANTIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "scoring_references" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" "ScoringReferenceKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "scoring_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "totalTenths" INTEGER NOT NULL,
    "plannedItems" INTEGER NOT NULL,
    "balancedTenths" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "status" "SessionScoreStatus" NOT NULL DEFAULT 'PENDENTE_FOTO',
    "performedAt" TIMESTAMP(3) NOT NULL,
    "photoDeadline" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_events" (
    "id" TEXT NOT NULL,
    "sessionScoreId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "totalTenths" INTEGER NOT NULL,
    "fromStatus" "SessionScoreStatus",
    "toStatus" "SessionScoreStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_references_studentId_exerciseId_kind_idx" ON "scoring_references"("studentId", "exerciseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "session_scores_sessionId_key" ON "session_scores"("sessionId");

-- CreateIndex
CREATE INDEX "session_scores_tenantId_studentId_performedAt_idx" ON "session_scores"("tenantId", "studentId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_scores_sessionId_tenantId_key" ON "session_scores"("sessionId", "tenantId");

-- CreateIndex
CREATE INDEX "score_events_sessionScoreId_createdAt_idx" ON "score_events"("sessionScoreId", "createdAt");

-- AddForeignKey
ALTER TABLE "scoring_references" ADD CONSTRAINT "scoring_references_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_scores" ADD CONSTRAINT "session_scores_sessionId_tenantId_fkey" FOREIGN KEY ("sessionId", "tenantId") REFERENCES "workout_sessions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_sessionScoreId_fkey" FOREIGN KEY ("sessionScoreId") REFERENCES "session_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Uma referência ativa por aluno, exercício e medida (as antigas ficam com supersededAt).
CREATE UNIQUE INDEX "scoring_references_active_key" ON "scoring_references"("studentId", "exerciseId", "kind") WHERE "supersededAt" IS NULL;
-- Valores sempre positivos.
ALTER TABLE "scoring_references" ADD CONSTRAINT "scoring_references_value_check" CHECK ("value" > 0);
ALTER TABLE "session_scores" ADD CONSTRAINT "session_scores_points_check" CHECK ("totalTenths" >= 0 AND "balancedTenths" >= 0 AND "plannedItems" >= 0);
