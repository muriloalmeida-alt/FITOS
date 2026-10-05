import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Aparelhos conectados (Configurações, EPIC-36): as sessões ativas da
/// conta, com um nome legível do aparelho e do navegador. Sair de um
/// aparelho apaga a sessão dele; a sessão atual nunca sai por aqui.

export interface Device {
  id: string;
  label: string;
  lastActive: Date;
  current: boolean;
}

export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  if (device && browser) return `${browser} no ${device}`;
  return device ?? browser ?? "Aparelho desconhecido";
}

export async function listDevices(input: { userId: string; currentSessionId: string | null; now?: Date }, client: PrismaClient = prisma): Promise<Device[]> {
  const sessions = await client.session.findMany({
    where: { userId: input.userId, expiresAt: { gt: input.now ?? new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userAgent: true, updatedAt: true },
  });
  return sessions
    .map((session) => ({ id: session.id, label: deviceLabel(session.userAgent), lastActive: session.updatedAt, current: session.id === input.currentSessionId }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function signOutDevice(input: { userId: string; sessionId: string; currentSessionId: string | null }, client: PrismaClient = prisma): Promise<boolean> {
  if (input.sessionId === input.currentSessionId) return false;
  const { count } = await client.session.deleteMany({ where: { id: input.sessionId, userId: input.userId } });
  return count > 0;
}

export async function signOutOtherDevices(input: { userId: string; currentSessionId: string }, client: PrismaClient = prisma): Promise<number> {
  const { count } = await client.session.deleteMany({ where: { userId: input.userId, id: { not: input.currentSessionId } } });
  return count;
}
