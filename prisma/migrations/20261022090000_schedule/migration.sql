-- CreateTable
CREATE TABLE "schedule_slots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "startsOn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "slotId" TEXT,
    "originalDate" TEXT,
    "date" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'AGENDADA',
    "note" TEXT,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_slots_tenantId_active_idx" ON "schedule_slots"("tenantId", "active");

-- CreateIndex
CREATE INDEX "schedule_slots_studentId_tenantId_idx" ON "schedule_slots"("studentId", "tenantId");

-- CreateIndex
CREATE INDEX "schedule_events_tenantId_date_idx" ON "schedule_events"("tenantId", "date");

-- CreateIndex
CREATE INDEX "schedule_events_studentId_tenantId_date_idx" ON "schedule_events"("studentId", "tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_events_slotId_originalDate_key" ON "schedule_events"("slotId", "originalDate");

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "schedule_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

