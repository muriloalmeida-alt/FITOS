-- FIT-041: execução de sessão de treino e registro de resultados.
--
-- `workout_sessions` estava vazia em todos os ambientes conhecidos no
-- momento desta migration (verificado via consulta direta antes de
-- gerá-la — nenhuma linha jamais foi criada, a tabela existe desde a
-- FIT-007 sem nenhum código produzindo dados) — por isso o DROP de
-- `occurredAt` e o NOT NULL de `startedAt` são seguros.

-- AlterTable
ALTER TABLE "workout_sessions" DROP COLUMN "occurredAt",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'EM_ANDAMENTO';

-- CreateTable
CREATE TABLE "workout_session_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "setsCompleted" INTEGER,
    "repsCompleted" INTEGER,
    "durationSecondsCompleted" INTEGER,
    "loadUsed" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_session_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_session_results_tenantId_idx" ON "workout_session_results"("tenantId");

-- CreateIndex
CREATE INDEX "workout_session_results_workoutSessionId_tenantId_idx" ON "workout_session_results"("workoutSessionId", "tenantId");

-- Um resultado por item por sessão — a própria defesa física contra
-- dupla submissão (reenviar o mesmo registro é um upsert, nunca uma
-- segunda linha).
-- CreateIndex
CREATE UNIQUE INDEX "workout_session_results_workoutSessionId_workoutExerciseId_key" ON "workout_session_results"("workoutSessionId", "workoutExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_exercises_id_tenantId_key" ON "workout_exercises"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_id_tenantId_key" ON "workout_sessions"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "workout_session_results" ADD CONSTRAINT "workout_session_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_results" ADD CONSTRAINT "workout_session_results_workoutSessionId_tenantId_fkey" FOREIGN KEY ("workoutSessionId", "tenantId") REFERENCES "workout_sessions"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session_results" ADD CONSTRAINT "workout_session_results_workoutExerciseId_tenantId_fkey" FOREIGN KEY ("workoutExerciseId", "tenantId") REFERENCES "workout_exercises"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice único parcial: no máximo uma sessão "EM_ANDAMENTO" por aluno.
-- Não representável no Prisma Schema (@@unique não suporta condição
-- WHERE) — mesmo padrão já usado em exercises_personal_tenant_name_key
-- (FIT-022), training_plans_tenant_draft_bucket_key (FIT-032) e
-- plan_assignments_active_per_student_key (FIT-033). Iniciar uma nova
-- sessão para um treino diferente enquanto outra está em andamento
-- abandona a anterior antes de criar a nova (mesma transação) — nunca
-- alcança este índice por exceção, ver `startOrResumeWorkoutSession`.
CREATE UNIQUE INDEX "workout_sessions_in_progress_per_student_key" ON "workout_sessions"("studentId", "tenantId") WHERE "status" = 'EM_ANDAMENTO';
