-- Funcional e CrossFit (feature 1, etapa 2): blocos do treino e metas por métrica.

-- AlterTable
ALTER TABLE "workout_exercises" ADD COLUMN     "blockKey" TEXT,
ADD COLUMN     "targetCalories" INTEGER,
ADD COLUMN     "targetDistanceMeters" INTEGER;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "blocks" JSONB;


ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_targets_check" CHECK (("targetDistanceMeters" IS NULL OR "targetDistanceMeters" > 0) AND ("targetCalories" IS NULL OR "targetCalories" > 0));
