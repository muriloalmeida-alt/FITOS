-- Treino avulso: o foco escolhido antes de começar (regiões e grupos musculares).
-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "focus" TEXT[] DEFAULT ARRAY[]::TEXT[];

