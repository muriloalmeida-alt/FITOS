-- FIT-052: gerar mensalidades recorrentes. Aditiva — `student_charges`
-- não tinha nenhuma linha real em nenhum ambiente conhecido além das
-- sintéticas de evidência (já removidas) no momento desta migration.

-- CreateEnum
CREATE TYPE "ChargeRecurrenceStatus" AS ENUM ('ATIVA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "charge_recurrences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "status" "ChargeRecurrenceStatus" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charge_recurrences_id_tenantId_key" ON "charge_recurrences"("id", "tenantId");

-- CreateIndex
CREATE INDEX "charge_recurrences_tenantId_idx" ON "charge_recurrences"("tenantId");

-- CreateIndex
CREATE INDEX "charge_recurrences_studentId_tenantId_idx" ON "charge_recurrences"("studentId", "tenantId");

-- AddForeignKey
ALTER TABLE "charge_recurrences" ADD CONSTRAINT "charge_recurrences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_recurrences" ADD CONSTRAINT "charge_recurrences_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "student_charges" ADD COLUMN     "recurrenceId" TEXT;

-- Defesa física contra geração duplicada da mesma competência para a
-- mesma recorrência (NULL nunca colide com NULL nesta constraint —
-- cobranças sem recorrência, a maioria, nunca são afetadas).
-- CreateIndex
CREATE UNIQUE INDEX "student_charges_recurrenceId_referenceMonth_key" ON "student_charges"("recurrenceId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_recurrenceId_tenantId_fkey" FOREIGN KEY ("recurrenceId", "tenantId") REFERENCES "charge_recurrences"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
