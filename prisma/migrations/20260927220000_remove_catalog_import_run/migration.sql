-- FIT-121: integração API Ninjas e a máquina de carga do catálogo global
-- (IMP-EX-001) foram descontinuadas — nenhuma carga real chegou a ser
-- executada em nenhum ambiente com este mecanismo (ver
-- docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md).
-- DropTable
DROP TABLE "catalog_import_runs";

-- DropEnum
DROP TYPE "CatalogImportEnvironment";

-- DropEnum
DROP TYPE "CatalogImportStatus";
