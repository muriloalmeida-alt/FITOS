-- AlterTable
ALTER TABLE "chat_topics" ADD COLUMN     "workoutName" TEXT,
ADD COLUMN     "workoutSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_topics_workoutSessionId_key" ON "chat_topics"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

