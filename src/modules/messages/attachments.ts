import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { detectImageMime } from "@/modules/media/photos";
import { ChatError, postMessage, type ChatViewer } from "./messages";

/// Anexos do chat (EPIC-40): o aluno grava a execução e manda na conversa
/// do exercício; o personal assiste e corrige. Também foto. O tipo vem
/// dos primeiros bytes, nunca do que o aparelho declarou.

export const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 90;
export const CHAT_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_RETENTION_DAYS = 90;

export function detectVideoMime(bytes: Uint8Array): "video/mp4" | "video/quicktime" | "video/webm" | null {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    return String.fromCharCode(...bytes.slice(8, 12)) === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

const positiveInt = (value: unknown, max: number): number | null => {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : null;
};

/// Envia um anexo na conversa, com legenda opcional.
export async function postAttachment(
  viewer: ChatViewer,
  topicId: string,
  input: { bytes: Uint8Array; caption?: unknown; durationSec?: unknown; width?: unknown; height?: unknown },
  deps: Parameters<typeof postMessage>[3] = {}
): Promise<{ id: string }> {
  const { bytes } = input;
  if (bytes.length === 0) throw new ChatError("VALIDACAO", "Escolha um vídeo ou uma foto.");
  const video = detectVideoMime(bytes);
  const image = video ? null : detectImageMime(bytes);
  if (!video && !image) throw new ChatError("VALIDACAO", "Use um vídeo (MP4, MOV, WebM) ou uma foto (JPG, PNG, WebP).");
  if (video && bytes.length > VIDEO_MAX_BYTES) throw new ChatError("VALIDACAO", "Vídeo grande demais. Grave até 30 segundos, só a execução.");
  if (image && bytes.length > CHAT_PHOTO_MAX_BYTES) throw new ChatError("VALIDACAO", "Foto grande demais. Tente outra.");
  const durationSec = video ? positiveInt(input.durationSec, 3600) : null;
  if (durationSec !== null && durationSec > VIDEO_MAX_SECONDS) throw new ChatError("VALIDACAO", `O vídeo pode ter até ${VIDEO_MAX_SECONDS} segundos.`);
  return postMessage(viewer, topicId, input.caption, deps, {
    kind: video ? "VIDEO" : "FOTO",
    mimeType: (video ?? image)!,
    data: bytes,
    durationSec,
    width: positiveInt(input.width, 10_000),
    height: positiveInt(input.height, 10_000),
  });
}

/// O anexo, só para quem participa da conversa.
export async function getAttachment(viewer: ChatViewer, attachmentId: string, client: PrismaClient = prisma) {
  const attachment = await client.chatAttachment.findFirst({
    where: { id: attachmentId, tenantId: viewer.tenantId, message: { topic: viewer.role === "ALUNO" ? { studentId: viewer.studentId } : {} } },
    select: { mimeType: true, data: true, sizeBytes: true },
  });
  if (!attachment) throw new ChatError("NAO_ENCONTRADO", "Anexo não encontrado.");
  if (!attachment.data) throw new ChatError("NAO_ENCONTRADO", "Este anexo expirou.");
  return { mimeType: attachment.mimeType, data: attachment.data };
}

/// Apaga o conteúdo dos anexos com mais de 90 dias (a mensagem fica).
export async function expireOldAttachments(now = new Date(), client: PrismaClient = prisma): Promise<number> {
  const cutoff = new Date(now.getTime() - ATTACHMENT_RETENTION_DAYS * 86_400_000);
  const { count } = await client.chatAttachment.updateMany({ where: { createdAt: { lt: cutoff }, expiredAt: null }, data: { data: null, expiredAt: now } });
  return count;
}

/// Resposta com suporte a Range: o Safari só toca vídeo assim.
export function rangeResponse(data: Uint8Array, mimeType: string, rangeHeader: string | null): Response {
  const total = data.length;
  const headers = { "Content-Type": mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" };
  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(new Uint8Array(data), { status: 200, headers: { ...headers, "Content-Length": String(total) } });
  }
  let start: number;
  let end: number;
  if (match[1] === "") {
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }
  if (start >= total || start > end) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${total}` } });
  return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${total}` } });
}
