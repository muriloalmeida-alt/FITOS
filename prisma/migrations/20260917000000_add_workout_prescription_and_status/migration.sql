-- Modelo de treino: prescrição, ciclo de vida e o alicerce físico do
-- versionamento por cópia na atribuição (FIT-030, EPIC-06/SPRINT-07).
-- Ver docs/06-engenharia/arquitetura/TREINOS-E-PLANOS.md e
-- docs/06-engenharia/arquitetura/adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md.
--
-- `training_plans`/`workouts`/`workout_exercises` estavam vazias em todos
-- os ambientes conhecidos no momento desta migration (verificado via
-- consulta direta antes de gerá-la) — por isso `updatedAt` pode ser
-- NOT NULL. Mesmo assim, um DEFAULT físico é adicionado defensivamente
-- (mesma decisão já tomada em `20260916040000_add_exercise_catalog_fields`,
-- FIT-021) para nunca quebrar caso algum ambiente já tenha linhas: toda
-- escrita via Prisma já define o valor via `@updatedAt`, então o DEFAULT
-- nunca é de fato exercido em uso normal.

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('ATIVO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "TrainingPlanStatus" AS ENUM ('ATIVO', 'ARQUIVADO');

-- AlterTable
ALTER TABLE "training_plans"
  ADD COLUMN "durationWeeks" INTEGER,
  ADD COLUMN "isSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" "TrainingPlanStatus" NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "workouts"
  ADD COLUMN "status" "WorkoutStatus" NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "suggestedDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "workout_exercises"
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "load" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "reps" INTEGER,
  ADD COLUMN "restSeconds" INTEGER,
  ADD COLUMN "sets" INTEGER,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Imutabilidade pós-atribuição (ADR-005): quando um TrainingPlan tem
-- isSnapshot = true, ele é uma cópia física criada pela atribuição
-- (FIT-033) — nenhum Workout/WorkoutExercise sob ele pode ser inserido,
-- alterado ou removido depois de criado. A criação do próprio snapshot
-- (feita pela FIT-033) precisa, portanto, inserir seus Workouts/
-- WorkoutExercises ENQUANTO o TrainingPlan ainda tem isSnapshot = false, e
-- só marcar isSnapshot = true como o último passo da mesma transação — a
-- mesma transação vê suas próprias escritas ainda não confirmadas (MVCC),
-- então os INSERTs anteriores nunca são bloqueados por este TRIGGER.
--
-- Não representável como CHECK constraint (precisa consultar outra
-- tabela) nem como FK — mesma técnica já usada pelos triggers de
-- isolamento e de imutabilidade de tenantId em Exercise (FIT-007).
CREATE OR REPLACE FUNCTION training_plan_is_snapshot(plan_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT "isSnapshot" INTO result FROM "training_plans" WHERE "id" = plan_id;
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_snapshot_immutability_workouts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF training_plan_is_snapshot(OLD."trainingPlanId") THEN
      RAISE EXCEPTION
        'workouts: o plano % e uma copia imutavel de atribuicao (isSnapshot), nao pode ser alterado',
        OLD."trainingPlanId";
    END IF;
    RETURN OLD;
  END IF;

  IF training_plan_is_snapshot(NEW."trainingPlanId") THEN
    RAISE EXCEPTION
      'workouts: o plano % e uma copia imutavel de atribuicao (isSnapshot), nao pode ser alterado',
      NEW."trainingPlanId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workouts_snapshot_immutability_guard
BEFORE INSERT OR UPDATE OR DELETE ON "workouts"
FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_immutability_workouts();

CREATE OR REPLACE FUNCTION workout_is_in_snapshot_plan(workout_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT tp."isSnapshot" INTO result
  FROM "workouts" w
  JOIN "training_plans" tp ON tp."id" = w."trainingPlanId"
  WHERE w."id" = workout_id;
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_snapshot_immutability_workout_exercises()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF workout_is_in_snapshot_plan(OLD."workoutId") THEN
      RAISE EXCEPTION
        'workout_exercises: o treino % pertence a um plano snapshot imutavel de atribuicao, nao pode ser alterado',
        OLD."workoutId";
    END IF;
    RETURN OLD;
  END IF;

  IF workout_is_in_snapshot_plan(NEW."workoutId") THEN
    RAISE EXCEPTION
      'workout_exercises: o treino % pertence a um plano snapshot imutavel de atribuicao, nao pode ser alterado',
      NEW."workoutId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_exercises_snapshot_immutability_guard
BEFORE INSERT OR UPDATE OR DELETE ON "workout_exercises"
FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_immutability_workout_exercises();

-- Fecha uma lacuna residual: uma vez marcado como snapshot, o próprio flag
-- nunca pode voltar a false (impede "destravar" uma cópia imutável já
-- criada). Os demais campos do TrainingPlan snapshot (nome, durationWeeks)
-- não são protegidos por TRIGGER — a aplicação nunca expõe uma rota de
-- edição para um plano com isSnapshot = true (decisão de escopo registrada
-- em docs/06-engenharia/arquitetura/adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md).
CREATE OR REPLACE FUNCTION enforce_training_plan_snapshot_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."isSnapshot" = true AND NEW."isSnapshot" = false THEN
    RAISE EXCEPTION
      'training_plans.isSnapshot nao pode voltar a false (plano % e uma copia imutavel de atribuicao)',
      OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_plans_snapshot_immutability_guard
BEFORE UPDATE ON "training_plans"
FOR EACH ROW EXECUTE FUNCTION enforce_training_plan_snapshot_immutability();
