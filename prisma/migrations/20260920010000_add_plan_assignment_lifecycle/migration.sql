-- FIT-033: encerramento controlado de atribuições e no máximo uma
-- atribuição ativa por aluno, imposto fisicamente (não apenas na aplicação).

-- AlterTable
ALTER TABLE "plan_assignments" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- Índice único parcial: garante no máximo uma linha "active = true" por
-- (studentId, tenantId). Não representável no Prisma Schema (@@unique não
-- suporta condição WHERE) — mesmo padrão já usado em
-- exercises_personal_tenant_name_key (FIT-022) e
-- training_plans_tenant_draft_bucket_key (FIT-032).
CREATE UNIQUE INDEX "plan_assignments_active_per_student_key" ON "plan_assignments"("studentId", "tenantId") WHERE "active" = true;
