-- Link de convite do personal (EPIC-29): um código por espaço; quem abre
-- o link cria a própria conta de aluno.
ALTER TABLE "tenants" ADD COLUMN "inviteCode" TEXT;
CREATE UNIQUE INDEX "tenants_inviteCode_key" ON "tenants"("inviteCode");
