-- FIT-013: Student passa a poder existir sem User (cadastro pelo personal,
-- antes da ativação do convite — FIT-015), e passa a guardar o próprio
-- e-mail (necessário enquanto não existe User vinculado). Todo Student
-- pré-existente no schema anterior tinha `userId` obrigatório; o backfill
-- abaixo deriva o e-mail e o `updatedAt` inicial a partir do User já
-- vinculado, sem perder nenhum dado.

-- AlterEnum: StudentStatus {ATIVO, PAUSADO, ARQUIVADO} -> {ATIVO, INATIVO}
-- (PAUSADO/ARQUIVADO eram especulação da FIT-007, nunca usados por nenhum
-- código nem dado real; nenhuma linha pré-existente usa esses valores).
BEGIN;
CREATE TYPE "StudentStatus_new" AS ENUM ('ATIVO', 'INATIVO');
ALTER TABLE "public"."students" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "students" ALTER COLUMN "status" TYPE "StudentStatus_new" USING ("status"::text::"StudentStatus_new");
ALTER TYPE "StudentStatus" RENAME TO "StudentStatus_old";
ALTER TYPE "StudentStatus_new" RENAME TO "StudentStatus";
DROP TYPE "public"."StudentStatus_old";
ALTER TABLE "students" ALTER COLUMN "status" SET DEFAULT 'ATIVO';
COMMIT;

-- AlterTable: novas colunas primeiro sem NOT NULL, para permitir backfill.
ALTER TABLE "students" ADD COLUMN "email" TEXT;
ALTER TABLE "students" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill: todo Student pré-existente tem "userId" preenchido (era
-- obrigatório no schema anterior) — deriva o e-mail do User vinculado;
-- "updatedAt" inicial recebe o próprio "createdAt".
UPDATE "students" AS s
SET "email" = u."email",
    "updatedAt" = s."createdAt"
FROM "users" AS u
WHERE s."userId" = u."id";

-- Agora que todo Student existente tem "email"/"updatedAt" preenchidos,
-- torna as colunas obrigatórias e libera "userId" (aluno pode existir sem
-- User até a ativação do convite).
ALTER TABLE "students" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex: e-mail único por tenant (não globalmente — dois tenants
-- podem cadastrar o mesmo e-mail antes de qualquer ativação; a colisão
-- real, se houver, se manifesta apenas na ativação, tratada na FIT-015).
CREATE UNIQUE INDEX "students_tenantId_email_key" ON "students"("tenantId", "email");
