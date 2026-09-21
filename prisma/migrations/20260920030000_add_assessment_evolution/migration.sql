-- FIT-042: avaliação e evolução básica. Aditiva — `assessments` estava
-- vazia em todos os ambientes conhecidos no momento desta migration
-- (verificado via consulta direta antes de gerá-la), então as colunas
-- novas podem ser adicionadas sem qualquer preocupação de dado existente.

-- CreateEnum
CREATE TYPE "BodyMeasurementType" AS ENUM ('CINTURA', 'QUADRIL', 'PEITO', 'BRACO', 'COXA', 'PANTURRILHA');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "bodyFatTenthPercent" INTEGER,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "body_measurements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "BodyMeasurementType" NOT NULL,
    "valueMillimeters" INTEGER NOT NULL,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_measurements_tenantId_idx" ON "body_measurements"("tenantId");

-- CreateIndex
CREATE INDEX "body_measurements_assessmentId_tenantId_idx" ON "body_measurements"("assessmentId", "tenantId");

-- Uma linha por tipo de medida por avaliação — evita duas medidas de
-- cintura na mesma avaliação por engano.
-- CreateIndex
CREATE UNIQUE INDEX "body_measurements_assessmentId_type_key" ON "body_measurements"("assessmentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_id_tenantId_key" ON "assessments"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_assessmentId_tenantId_fkey" FOREIGN KEY ("assessmentId", "tenantId") REFERENCES "assessments"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
