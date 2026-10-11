-- CreateTable
CREATE TABLE "health_forms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "parqYes" INTEGER NOT NULL,
    "filledByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_forms_studentId_key" ON "health_forms"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "health_forms_studentId_tenantId_key" ON "health_forms"("studentId", "tenantId");

-- AddForeignKey
ALTER TABLE "health_forms" ADD CONSTRAINT "health_forms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_forms" ADD CONSTRAINT "health_forms_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_forms" ADD CONSTRAINT "health_forms_filledByUserId_fkey" FOREIGN KEY ("filledByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

