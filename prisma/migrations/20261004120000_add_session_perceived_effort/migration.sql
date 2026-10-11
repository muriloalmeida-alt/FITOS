-- BK-13 (FIT-145/FIT-153, EPIC-19/20): esforço percebido do treino, de 1
-- (leve) a 5 (no limite), informado pelo aluno ao concluir a sessão.
-- Opcional: sessões antigas e sessões sem resposta ficam NULL.
ALTER TABLE "workout_sessions" ADD COLUMN "perceivedEffort" INTEGER;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_perceivedEffort_range" CHECK ("perceivedEffort" IS NULL OR ("perceivedEffort" BETWEEN 1 AND 5));
