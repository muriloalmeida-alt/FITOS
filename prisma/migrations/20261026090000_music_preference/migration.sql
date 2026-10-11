-- Música em um toque: serviço preferido (spotify | apple_music) por usuário.
-- CreateTable
CREATE TABLE "music_preferences" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_preferences_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "music_preferences" ADD CONSTRAINT "music_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

