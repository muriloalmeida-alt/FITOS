-- CreateTable
CREATE TABLE "chat_topics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exerciseId" TEXT,
    "exerciseName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStudentMessageAt" TIMESTAMP(3),
    "lastPersonalMessageAt" TIMESTAMP(3),
    "studentReadAt" TIMESTAMP(3),
    "personalReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "fromStudent" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_topics_tenantId_lastMessageAt_idx" ON "chat_topics"("tenantId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_topics_studentId_tenantId_idx" ON "chat_topics"("studentId", "tenantId");

-- CreateIndex
CREATE INDEX "chat_messages_topicId_createdAt_idx" ON "chat_messages"("topicId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "chat_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

