-- Funcional e CrossFit (feature 1, etapa 3): resultado e timer de cada bloco na execução ao vivo.

-- CreateTable
CREATE TABLE "workout_block_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "roundsCompleted" INTEGER,
    "partialReps" INTEGER,
    "intervalsCompleted" INTEGER,
    "elapsedSeconds" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_block_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_block_results_sessionId_blockKey_key" ON "workout_block_results"("sessionId", "blockKey");

-- AddForeignKey
ALTER TABLE "workout_block_results" ADD CONSTRAINT "workout_block_results_sessionId_tenantId_fkey" FOREIGN KEY ("sessionId", "tenantId") REFERENCES "workout_sessions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "workout_block_results" ADD CONSTRAINT "workout_block_results_values_check" CHECK (("outcome" IS NULL OR "outcome" IN ('CONCLUIDO', 'LIMITE_ATINGIDO', 'PARCIAL')) AND "pausedSeconds" >= 0 AND ("roundsCompleted" IS NULL OR "roundsCompleted" >= 0) AND ("partialReps" IS NULL OR "partialReps" >= 0) AND ("intervalsCompleted" IS NULL OR "intervalsCompleted" >= 0) AND ("elapsedSeconds" IS NULL OR "elapsedSeconds" > 0));
-- Limite atingido nunca guarda tempo de conclusão.
ALTER TABLE "workout_block_results" ADD CONSTRAINT "workout_block_results_cap_check" CHECK ("outcome" IS DISTINCT FROM 'LIMITE_ATINGIDO' OR "elapsedSeconds" IS NULL);
