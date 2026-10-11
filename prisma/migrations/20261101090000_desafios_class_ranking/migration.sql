-- CreateTable
CREATE TABLE "class_rankings" (
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_rankings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "class_ranking_participants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "class_ranking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_ranking_participants_studentId_key" ON "class_ranking_participants"("studentId");

-- CreateIndex
CREATE INDEX "class_ranking_participants_tenantId_idx" ON "class_ranking_participants"("tenantId");

-- AddForeignKey
ALTER TABLE "class_rankings" ADD CONSTRAINT "class_rankings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_ranking_participants" ADD CONSTRAINT "class_ranking_participants_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

