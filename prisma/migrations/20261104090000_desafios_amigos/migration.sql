-- Desafios (feature 3, 4/4): grupos de amigos por convite, membros e temporadas.

-- CreateTable
CREATE TABLE "friend_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "friend_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_seasons" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "lengthDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friend_groups_inviteCode_key" ON "friend_groups"("inviteCode");

-- CreateIndex
CREATE INDEX "friend_group_members_userId_idx" ON "friend_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "friend_group_members_groupId_userId_key" ON "friend_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "friend_seasons_groupId_startsAt_idx" ON "friend_seasons"("groupId", "startsAt");

-- AddForeignKey
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "friend_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_studentId_tenantId_fkey" FOREIGN KEY ("studentId", "tenantId") REFERENCES "students"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_seasons" ADD CONSTRAINT "friend_seasons_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "friend_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_mode_check" CHECK ("mode" IN ('TOTAL', 'EQUILIBRADO'));
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_role_check" CHECK ("role" IN ('ORGANIZADOR', 'MEMBRO'));
ALTER TABLE "friend_seasons" ADD CONSTRAINT "friend_seasons_length_check" CHECK ("lengthDays" IN (7, 14, 28) AND "endsAt" > "startsAt");
