-- BK-11/BK-14 (FIT-153, EPIC-20, ADR-015): registro por série na execução
-- e tempo ativo da sessão. O agregado `workout_session_results` continua
-- sendo mantido pela aplicação a cada série.

ALTER TABLE "workout_sessions" ADD COLUMN "activeSeconds" INTEGER;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_activeSeconds_positive" CHECK ("activeSeconds" IS NULL OR "activeSeconds" >= 0);

CREATE TABLE "workout_set_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "durationSeconds" INTEGER,
    "loadGrams" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_set_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workout_set_results_values_check" CHECK ("setNumber" >= 1 AND ("reps" IS NULL OR "reps" > 0) AND ("durationSeconds" IS NULL OR "durationSeconds" > 0) AND ("loadGrams" IS NULL OR "loadGrams" >= 0))
);

CREATE UNIQUE INDEX "workout_set_results_workoutSessionId_workoutExerciseId_setN_key" ON "workout_set_results"("workoutSessionId", "workoutExerciseId", "setNumber");
CREATE INDEX "workout_set_results_tenantId_idx" ON "workout_set_results"("tenantId");
CREATE INDEX "workout_set_results_workoutExerciseId_tenantId_idx" ON "workout_set_results"("workoutExerciseId", "tenantId");

ALTER TABLE "workout_set_results" ADD CONSTRAINT "workout_set_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_set_results" ADD CONSTRAINT "workout_set_results_workoutSessionId_tenantId_fkey" FOREIGN KEY ("workoutSessionId", "tenantId") REFERENCES "workout_sessions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_set_results" ADD CONSTRAINT "workout_set_results_workoutExerciseId_tenantId_fkey" FOREIGN KEY ("workoutExerciseId", "tenantId") REFERENCES "workout_exercises"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
