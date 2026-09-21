-- FIT-050/FIT-051: cadastrar cobrança e registrar pagamento. Migration
-- única cobrindo as duas Histórias — Payment depende diretamente da
-- extensão de StudentCharge feita aqui, e ambas chegam no mesmo checkpoint
-- de mudança de schema (decisão registrada no diário de execução).
--
-- `student_charges` tinha 2 linhas sintéticas no momento desta migration
-- (seed de FIT-007, `prisma/seed.ts`) — verificado via consulta direta
-- antes de gerá-la. Como `description`/`referenceMonth` passam a ser
-- obrigatórias, o backfill abaixo preenche essas 2 linhas com valores
-- equivalentes ao que o seed sempre pretendeu (mensalidade, competência =
-- mês do vencimento) antes de aplicar a constraint NOT NULL — nenhuma
-- linha real de personal/aluno existe em nenhum ambiente conhecido.

-- AlterTable (colunas nullable primeiro, para permitir o backfill)
ALTER TABLE "student_charges" ADD COLUMN     "description" TEXT,
ADD COLUMN     "referenceMonth" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- Backfill das linhas sintéticas pré-existentes (seed de FIT-007).
UPDATE "student_charges"
SET "description" = 'Mensalidade',
    "referenceMonth" = date_trunc('month', "dueDate")
WHERE "description" IS NULL;

-- Agora torna as duas colunas obrigatórias, como no schema.prisma.
ALTER TABLE "student_charges" ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "referenceMonth" SET NOT NULL;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentChargeId" TEXT NOT NULL,
    "amountCentsPaid" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Um pagamento por cobrança no MVP ("cobrança pode possuir zero ou um
-- pagamento", MODELO-DE-DADOS.md) — índice único físico, não só validação
-- de aplicação.
-- CreateIndex
CREATE UNIQUE INDEX "payments_studentChargeId_key" ON "payments"("studentChargeId");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentChargeId_fkey" FOREIGN KEY ("studentChargeId") REFERENCES "student_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
