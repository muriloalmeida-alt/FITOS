import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isMusicProvider, type MusicProvider } from "@/shared/lib/music";

/// Preferência de música do próprio usuário (nunca de outro).
export async function getMusicPreference(userId: string, client: PrismaClient = prisma): Promise<MusicProvider | null> {
  const row = await client.musicPreference.findUnique({ where: { userId } });
  return row && isMusicProvider(row.provider) ? row.provider : null;
}

export async function setMusicPreference(userId: string, provider: MusicProvider, client: PrismaClient = prisma): Promise<void> {
  await client.musicPreference.upsert({ where: { userId }, create: { userId, provider }, update: { provider } });
}
