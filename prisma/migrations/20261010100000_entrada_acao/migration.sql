-- AlterTable
ALTER TABLE "personal_profiles" ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "objective" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "inviteFeeCents" INTEGER,
ADD COLUMN     "inviteFeeDay" INTEGER,
ADD COLUMN     "inviteProgramId" TEXT;

-- Dia da mensalidade do convite sempre de 1 a 28 (mesma regra das recorrências).
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_inviteFeeDay_check" CHECK ("inviteFeeDay" IS NULL OR ("inviteFeeDay" >= 1 AND "inviteFeeDay" <= 28));
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_inviteFeeCents_check" CHECK ("inviteFeeCents" IS NULL OR "inviteFeeCents" > 0);
