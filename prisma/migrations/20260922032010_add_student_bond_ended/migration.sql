-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'VINCULO_ENCERRADO';

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "endedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_endedByUserId_fkey" FOREIGN KEY ("endedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
