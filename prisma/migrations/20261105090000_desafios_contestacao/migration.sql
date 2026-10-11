-- Desafios (feature 3, 4/4, parte B): contestação de pontos com revisor, decisão auditada e recurso.

-- CreateTable
CREATE TABLE "score_contests" (
    "id" TEXT NOT NULL,
    "sessionScoreId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "friendGroupId" TEXT,
    "classTenantId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "previousStatus" "SessionScoreStatus" NOT NULL,
    "decision" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "isAppeal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_contests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_contests_reviewerUserId_status_idx" ON "score_contests"("reviewerUserId", "status");

-- CreateIndex
CREATE INDEX "score_contests_sessionScoreId_idx" ON "score_contests"("sessionScoreId");

-- AddForeignKey
ALTER TABLE "score_contests" ADD CONSTRAINT "score_contests_sessionScoreId_fkey" FOREIGN KEY ("sessionScoreId") REFERENCES "session_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_contests" ADD CONSTRAINT "score_contests_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_contests" ADD CONSTRAINT "score_contests_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "score_contests" ADD CONSTRAINT "score_contests_context_check" CHECK ("context" IN ('AMIGOS', 'TURMA') AND ("context" <> 'AMIGOS' OR "friendGroupId" IS NOT NULL) AND ("context" <> 'TURMA' OR "classTenantId" IS NOT NULL));
ALTER TABLE "score_contests" ADD CONSTRAINT "score_contests_status_check" CHECK ("status" IN ('ABERTA', 'MANTIDO', 'ANULADO') AND ("status" = 'ABERTA' OR ("decision" IS NOT NULL AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)));
-- Uma contestação aberta por treino; o mesmo participante não contesta o mesmo treino duas vezes; um recurso por treino.
CREATE UNIQUE INDEX "score_contests_one_open_per_score" ON "score_contests"("sessionScoreId") WHERE "status" = 'ABERTA';
CREATE UNIQUE INDEX "score_contests_one_per_opener" ON "score_contests"("sessionScoreId", "openedByUserId") WHERE NOT "isAppeal";
CREATE UNIQUE INDEX "score_contests_one_appeal" ON "score_contests"("sessionScoreId") WHERE "isAppeal";
