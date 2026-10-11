-- AlterTable
ALTER TABLE "workout_session_results" ADD COLUMN     "performedExerciseId" TEXT;

-- AlterTable
ALTER TABLE "workout_set_results" ADD COLUMN     "performedExerciseId" TEXT;

-- AddForeignKey
ALTER TABLE "workout_session_results" ADD CONSTRAINT "workout_session_results_performedExerciseId_fkey" FOREIGN KEY ("performedExerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_set_results" ADD CONSTRAINT "workout_set_results_performedExerciseId_fkey" FOREIGN KEY ("performedExerciseId") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

