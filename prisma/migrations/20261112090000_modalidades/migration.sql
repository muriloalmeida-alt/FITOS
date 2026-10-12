-- Proposta 11 ("Seu jeito de treinar"): modalidades preferidas do Livre
-- (perfil do onboarding) e do aluno com personal, e a classificação dos
-- programas. Coleções de ids estáveis; vazio = não definido. A CHECK
-- garante só ids conhecidos (a validação de lista não vazia e sem
-- duplicatas fica no servidor, `shared/lib/modalities.ts`).

-- AlterTable
ALTER TABLE "individual_profiles" ADD COLUMN     "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN     "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "individual_profiles" ADD CONSTRAINT "individual_profiles_modalities_known" CHECK ("modalities" <@ ARRAY['musculacao', 'funcional', 'crossfit']::TEXT[]);
ALTER TABLE "students" ADD CONSTRAINT "students_modalities_known" CHECK ("modalities" <@ ARRAY['musculacao', 'funcional', 'crossfit']::TEXT[]);
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_modalities_known" CHECK ("modalities" <@ ARRAY['musculacao', 'funcional', 'crossfit']::TEXT[]);

-- Os programas prontos de Funcional e CrossFit (material "FitOS Funcional
-- CrossFit") usam dois exercícios que o catálogo ainda não tinha. Entram
-- sem imagem (a tela mostra "Sem imagem"). Idempotente por origem e
-- externalId; nenhum exercício existente muda.
INSERT INTO "exercises" ("id", "tenantId", "name", "origin", "status", "externalId", "type", "muscle", "equipments", "difficulty", "instructions", "imageUrl", "imageAlt", "categories", "secondaryMuscles", "aliases", "metric", "createdAt", "updatedAt")
VALUES
  ('funcional_agachamento_ate_o_banco', NULL, 'Agachamento até o banco', 'FITOS_CURATED', 'ATIVO', 'fitos:agachamento-ate-o-banco', 'Peso corporal', 'Quadríceps', 'banco ou caixa', 'iniciante', 'Sentar no banco com controle, flexionando quadris e joelhos, e levantar até ficar em pé.', NULL, NULL, ARRAY['Funcional']::TEXT[], ARRAY['Glúteos', 'Core']::TEXT[], ARRAY['Agachamento até banco', 'Box squat', 'Sentar e levantar']::TEXT[], 'REPS', NOW(), NOW()),
  ('funcional_remada_com_elastico', NULL, 'Remada com elástico', 'FITOS_CURATED', 'ATIVO', 'fitos:remada-com-elastico', 'Peso corporal', 'Costas', 'elástico', 'iniciante', 'Com o elástico preso à frente, puxar as mãos em direção ao tronco aproximando as escápulas e voltar com controle.', NULL, NULL, ARRAY['Funcional']::TEXT[], ARRAY['Bíceps', 'Ombros']::TEXT[], ARRAY['Remada com banda', 'Band row']::TEXT[], 'REPS', NOW(), NOW())
ON CONFLICT ("origin", "externalId") DO NOTHING;

UPDATE "exercises" SET "searchText" = translate(lower(concat_ws(' ', "name", array_to_string("aliases", ' '), "muscle", array_to_string("secondaryMuscles", ' '))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
WHERE "origin" = 'FITOS_CURATED' AND "externalId" IN ('fitos:agachamento-ate-o-banco', 'fitos:remada-com-elastico');
