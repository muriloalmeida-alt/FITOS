-- EPIC-32: versão da biblioteca inicial por espaço. Quem já recebeu a
-- primeira (EPIC-28) fica na versão 1 e ganha só os treinos prontos novos.
ALTER TABLE "tenants" ADD COLUMN "starterLibraryVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "tenants" SET "starterLibraryVersion" = 1 WHERE "starterLibraryAt" IS NOT NULL;
