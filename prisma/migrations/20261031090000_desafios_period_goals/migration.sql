-- CreateTable
CREATE TABLE "period_goals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "goalTenths" INTEGER NOT NULL,
    "plannedDays" INTEGER NOT NULL,
    "itemsPerWorkout" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_goals_studentId_periodType_periodKey_key" ON "period_goals"("studentId", "periodType", "periodKey");

-- AddForeignKey
ALTER TABLE "period_goals" ADD CONSTRAINT "period_goals_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "period_goals" ADD CONSTRAINT "period_goals_goal_check" CHECK ("goalTenths" > 0);
