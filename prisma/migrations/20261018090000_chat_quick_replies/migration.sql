-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "chatQuickReplies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "chatQuickRepliesSet" BOOLEAN NOT NULL DEFAULT false;

