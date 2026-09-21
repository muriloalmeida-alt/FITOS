-- Identifica explicitamente o plano "rascunho" implícito por tenant
-- (FIT-032, bug encontrado durante a captura de evidência visual: a
-- heurística anterior — "o primeiro TrainingPlan criado, por createdAt" —
-- quebraria silenciosamente se o personal criasse um plano real antes de
-- qualquer modelo avulso). Ver docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md.
--
-- As duas linhas "ALTER COLUMN ... DROP DEFAULT" corrigem drift já
-- detectado em migrations anteriores (20260917000000): o DEFAULT físico
-- CURRENT_TIMESTAMP em updatedAt nunca foi declarado no schema.prisma
-- (que só tem @updatedAt) — sem efeito no comportamento real, toda
-- escrita via Prisma já define o valor.

-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN     "isDraftBucket" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workout_exercises" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workouts" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- No máximo um plano rascunho por tenant — não representável no Prisma
-- Schema (índice único parcial), mesma técnica já usada para duplicidade
-- de nome de exercício próprio (FIT-022, exercises_personal_tenant_name_key).
CREATE UNIQUE INDEX "training_plans_tenant_draft_bucket_key" ON "training_plans" ("tenantId") WHERE "isDraftBucket" = true;
