import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { ChatError } from "./messages";

/// Respostas rápidas do personal (EPIC-41): textos salvos que entram no
/// campo da conversa com um toque (dá para ajustar antes de enviar).

export const DEFAULT_QUICK_REPLIES = [
  "Boa! Execução certa, pode seguir assim.",
  "Desça mais devagar, controlando o peso.",
  "Pode subir 2 kg na próxima série.",
  "Diminua a carga e foque na postura.",
  "Se doer, pare e me avise. Vamos ajustar.",
  "Vou olhar e já te respondo.",
];
export const MAX_QUICK_REPLIES = 20;
export const MAX_QUICK_REPLY_LENGTH = 300;

export async function getQuickReplies(tenantId: string, client: PrismaClient = prisma): Promise<string[]> {
  const tenant = await client.tenant.findUnique({ where: { id: tenantId }, select: { chatQuickReplies: true, chatQuickRepliesSet: true } });
  return tenant?.chatQuickRepliesSet ? tenant.chatQuickReplies : DEFAULT_QUICK_REPLIES;
}

export async function setQuickReplies(tenantId: string, raw: unknown, client: PrismaClient = prisma): Promise<string[]> {
  if (!Array.isArray(raw)) throw new ChatError("VALIDACAO", "Lista inválida.");
  const replies = [...new Set(raw.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
  if (replies.length > MAX_QUICK_REPLIES) throw new ChatError("VALIDACAO", `Até ${MAX_QUICK_REPLIES} respostas rápidas.`);
  if (replies.some((reply) => reply.length > MAX_QUICK_REPLY_LENGTH)) throw new ChatError("VALIDACAO", `Cada resposta pode ter até ${MAX_QUICK_REPLY_LENGTH} caracteres.`);
  await client.tenant.update({ where: { id: tenantId }, data: { chatQuickReplies: replies, chatQuickRepliesSet: true } });
  return replies;
}
