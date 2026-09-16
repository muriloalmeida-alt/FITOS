-- Correção de integridade relacional multi-tenant (revisão do PR #19).
--
-- Antes desta migration, tenantId existia e estava indexado em toda tabela
-- de domínio, mas as relações (Workout->TrainingPlan, WorkoutExercise->
-- Workout, PlanAssignment->Student/TrainingPlan, WorkoutSession->Student/
-- Workout, Assessment->Student, StudentCharge->Student) usavam apenas o id
-- do registro pai, sem exigir que o tenantId da linha filha coincidisse com
-- o tenantId do registro pai. Isso permitia, por exemplo, um Workout do
-- tenant A referenciar um TrainingPlan do tenant B.
--
-- Esta migration substitui essas foreign keys simples por foreign keys
-- compostas (childId, tenantId) -> (parentId, tenantId), apoiadas por
-- constraints UNIQUE(id, tenantId) nas tabelas pai. O PostgreSQL passa a
-- rejeitar fisicamente qualquer INSERT/UPDATE cujo tenantId da linha filha
-- não coincida com o tenantId do registro pai referenciado.

-- DropForeignKey
ALTER TABLE "assessments" DROP CONSTRAINT "assessments_studentId_fkey";

-- DropForeignKey
ALTER TABLE "plan_assignments" DROP CONSTRAINT "plan_assignments_studentId_fkey";

-- DropForeignKey
ALTER TABLE "plan_assignments" DROP CONSTRAINT "plan_assignments_trainingPlanId_fkey";

-- DropForeignKey
ALTER TABLE "student_charges" DROP CONSTRAINT "student_charges_studentId_fkey";

-- DropForeignKey
ALTER TABLE "workout_exercises" DROP CONSTRAINT "workout_exercises_workoutId_fkey";

-- DropForeignKey
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_studentId_fkey";

-- DropForeignKey
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_workoutId_fkey";

-- DropForeignKey
ALTER TABLE "workouts" DROP CONSTRAINT "workouts_trainingPlanId_fkey";

-- DropIndex
DROP INDEX "assessments_studentId_idx";

-- DropIndex
DROP INDEX "plan_assignments_studentId_idx";

-- DropIndex
DROP INDEX "student_charges_studentId_idx";

-- DropIndex
DROP INDEX "workout_exercises_workoutId_idx";

-- DropIndex
DROP INDEX "workout_sessions_studentId_idx";

-- DropIndex
DROP INDEX "workouts_trainingPlanId_idx";

-- CreateIndex
CREATE INDEX "assessments_studentId_tenantId_idx" ON "assessments"("studentId", "tenantId");

-- CreateIndex
CREATE INDEX "plan_assignments_studentId_tenantId_idx" ON "plan_assignments"("studentId", "tenantId");

-- CreateIndex
CREATE INDEX "plan_assignments_trainingPlanId_tenantId_idx" ON "plan_assignments"("trainingPlanId", "tenantId");

-- CreateIndex
CREATE INDEX "student_charges_studentId_tenantId_idx" ON "student_charges"("studentId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "students_id_tenantId_key" ON "students"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "training_plans_id_tenantId_key" ON "training_plans"("id", "tenantId");

-- CreateIndex
CREATE INDEX "workout_exercises_workoutId_tenantId_idx" ON "workout_exercises"("workoutId", "tenantId");

-- CreateIndex
CREATE INDEX "workout_sessions_studentId_tenantId_idx" ON "workout_sessions"("studentId", "tenantId");

-- CreateIndex
CREATE INDEX "workout_sessions_workoutId_tenantId_idx" ON "workout_sessions"("workoutId", "tenantId");

-- CreateIndex
CREATE INDEX "workouts_trainingPlanId_tenantId_idx" ON "workouts"("trainingPlanId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "workouts_id_tenantId_key" ON "workouts"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_trainingPlanId_tenantId_fkey" FOREIGN KEY ("trainingPlanId", "tenantId") REFERENCES "training_plans"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workoutId_tenantId_fkey" FOREIGN KEY ("workoutId", "tenantId") REFERENCES "workouts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_trainingPlanId_tenantId_fkey" FOREIGN KEY ("trainingPlanId", "tenantId") REFERENCES "training_plans"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workoutId_tenantId_fkey" FOREIGN KEY ("workoutId", "tenantId") REFERENCES "workouts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regra "exercício privado só pode ser usado por treino do mesmo tenant;
-- exercício global (tenantId nulo) pode ser usado por qualquer tenant".
--
-- Não representável como foreign key composta: Exercise.tenantId pode ser
-- NULL (catálogo global), e uma FK composta (exerciseId, tenantId) exigiria
-- igualdade exata, rejeitando todo exercício global. PostgreSQL também não
-- permite CHECK constraint referenciando outra tabela. A solução é um
-- TRIGGER que consulta a linha de Exercise e só bloqueia quando o exercício
-- é privado (tenantId IS NOT NULL) e pertence a um tenant diferente do
-- WorkoutExercise que está sendo inserido/atualizado.
CREATE OR REPLACE FUNCTION enforce_workout_exercise_tenant()
RETURNS TRIGGER AS $$
DECLARE
  exercise_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO exercise_tenant FROM "exercises" WHERE "id" = NEW."exerciseId";

  IF exercise_tenant IS NOT NULL AND exercise_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION
      'workout_exercises.tenantId (%) nao corresponde ao tenant do exercicio privado (%)',
      NEW."tenantId", exercise_tenant;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_exercises_tenant_guard
BEFORE INSERT OR UPDATE ON "workout_exercises"
FOR EACH ROW EXECUTE FUNCTION enforce_workout_exercise_tenant();
