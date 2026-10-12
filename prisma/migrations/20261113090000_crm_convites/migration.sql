-- CRM de convites (admin): futuros clientes do FitOS Livre convidados pelo
-- WhatsApp, cada um com o próprio cupom de uso único e um link rastreável.

-- CreateEnum
CREATE TYPE "CrmProspectStatus" AS ENUM ('NOVO', 'CONVIDADO', 'ABERTO', 'CADASTRADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "crm_prospects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "status" "CrmProspectStatus" NOT NULL DEFAULT 'NOVO',
    "token" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3),
    "inviteCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "signedUpAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_prospects_phone_key" ON "crm_prospects"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "crm_prospects_token_key" ON "crm_prospects"("token");

-- CreateIndex
CREATE UNIQUE INDEX "crm_prospects_couponId_key" ON "crm_prospects"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_prospects_tenantId_key" ON "crm_prospects"("tenantId");

-- CreateIndex
CREATE INDEX "crm_prospects_status_createdAt_idx" ON "crm_prospects"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

