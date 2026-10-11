import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getStudentForTenant } from "@/modules/students/students";

/// Foto de perfil e fotos de evolução (EPIC-35). As imagens chegam já
/// reduzidas pelo aparelho e ficam no banco: nenhuma URL pública, toda
/// leitura passa por uma rota autenticada ("Fotos e dados corporais devem
/// ter acesso autenticado", REGRAS-DE-NEGOCIO seção 7).

export class PhotoError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "SEM_AUTORIZACAO",
    message: string
  ) {
    super(message);
    this.name = "PhotoError";
  }
}

export const AVATAR_MAX_BYTES = 512 * 1024;
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_POSES = ["FRENTE", "LADO", "COSTAS"] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];

/// Tipo real pelos primeiros bytes — nunca pelo nome ou pelo tipo que o
/// cliente declarou.
export function detectImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function validImage(bytes: Uint8Array, maxBytes: number) {
  if (bytes.length === 0) throw new PhotoError("VALIDACAO", "Escolha uma foto.");
  if (bytes.length > maxBytes) throw new PhotoError("VALIDACAO", "Foto grande demais. Tente outra.");
  const mime = detectImageMime(bytes);
  if (!mime) throw new PhotoError("VALIDACAO", "Use uma foto em JPG, PNG ou WebP.");
  return mime;
}

export function avatarUrl(userId: string, version: Date): string {
  return `/api/avatar/${userId}?v=${version.getTime()}`;
}

export async function setUserAvatar(input: { userId: string; bytes: Uint8Array }, client: PrismaClient = prisma): Promise<string> {
  const mimeType = validImage(input.bytes, AVATAR_MAX_BYTES);
  const data = Buffer.from(input.bytes);
  return client.$transaction(async (tx) => {
    const avatar = await tx.userAvatar.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, mimeType, data },
      update: { mimeType, data },
    });
    const image = avatarUrl(input.userId, avatar.updatedAt);
    await tx.user.update({ where: { id: input.userId }, data: { image } });
    return image;
  });
}

export async function removeUserAvatar(userId: string, client: PrismaClient = prisma): Promise<void> {
  await client.$transaction([client.userAvatar.deleteMany({ where: { userId } }), client.user.update({ where: { id: userId }, data: { image: null } })]);
}

export async function getUserAvatar(userId: string, client: PrismaClient = prisma) {
  return client.userAvatar.findUnique({ where: { userId } });
}

type Scope = { tenantId: string; studentId: string };

async function studentInScope(scope: Scope, client: PrismaClient) {
  const student = await getStudentForTenant({ tenantId: scope.tenantId, studentId: scope.studentId }, client);
  if (!student) throw new PhotoError("NAO_ENCONTRADO", "Aluno não encontrado.");
  return student;
}

/// Autorização explícita do aluno: dada por ele mesmo ou declarada pelo
/// personal ("o aluno autorizou"), sempre com quem e quando.
export async function recordPhotoConsent(input: Scope & { actorUserId: string }, client: PrismaClient = prisma): Promise<void> {
  const student = await studentInScope(input, client);
  if (student.photoConsentAt) return;
  await client.student.update({ where: { id: student.id }, data: { photoConsentAt: new Date(), photoConsentByUserId: input.actorUserId } });
}

/// Retirar a autorização apaga as fotos: sem autorização, elas não ficam.
export async function revokePhotoConsent(input: Scope, client: PrismaClient = prisma): Promise<void> {
  const student = await studentInScope(input, client);
  await client.$transaction([
    client.evolutionPhoto.deleteMany({ where: { tenantId: input.tenantId, studentId: student.id } }),
    client.student.update({ where: { id: student.id }, data: { photoConsentAt: null, photoConsentByUserId: null } }),
  ]);
}

export async function addEvolutionPhoto(
  input: Scope & { actorUserId: string; pose: string; bytes: Uint8Array; width: number; height: number },
  client: PrismaClient = prisma
) {
  const student = await studentInScope(input, client);
  if (!student.photoConsentAt) throw new PhotoError("SEM_AUTORIZACAO", "Falta a autorização do aluno para as fotos.");
  if (!(PHOTO_POSES as readonly string[]).includes(input.pose)) throw new PhotoError("VALIDACAO", "Escolha frente, lado ou costas.");
  const mimeType = validImage(input.bytes, PHOTO_MAX_BYTES);
  const width = Math.round(input.width);
  const height = Math.round(input.height);
  if (!(width > 0 && width <= 4096 && height > 0 && height <= 4096)) throw new PhotoError("VALIDACAO", "Tamanho de foto inválido.");
  return client.evolutionPhoto.create({
    data: { tenantId: input.tenantId, studentId: student.id, uploadedById: input.actorUserId, pose: input.pose, mimeType, width, height, data: Buffer.from(input.bytes) },
    select: { id: true, pose: true, takenAt: true, width: true, height: true },
  });
}

export type EvolutionPhotoSummary = { id: string; pose: PhotoPose; takenAt: Date; width: number; height: number };

export async function listEvolutionPhotos(scope: Scope, client: PrismaClient = prisma): Promise<EvolutionPhotoSummary[]> {
  const rows = await client.evolutionPhoto.findMany({
    where: { tenantId: scope.tenantId, studentId: scope.studentId },
    orderBy: { takenAt: "desc" },
    select: { id: true, pose: true, takenAt: true, width: true, height: true },
  });
  return rows.map((row) => ({ ...row, pose: row.pose as PhotoPose }));
}

/// Quem pode ver/excluir uma foto: o personal do tenant, o próprio aluno
/// (vínculo ativo) e o praticante do Livre (dono do tenant).
export type PhotoViewer = { role: "PERSONAL" | "INDIVIDUAL"; tenantId: string } | { role: "ALUNO"; tenantId: string; studentId: string };

function viewerWhere(viewer: PhotoViewer, photoId: string) {
  return viewer.role === "ALUNO" ? { id: photoId, tenantId: viewer.tenantId, studentId: viewer.studentId } : { id: photoId, tenantId: viewer.tenantId };
}

export async function getEvolutionPhotoForViewer(viewer: PhotoViewer, photoId: string, client: PrismaClient = prisma) {
  return client.evolutionPhoto.findFirst({ where: viewerWhere(viewer, photoId), select: { mimeType: true, data: true } });
}

export async function deleteEvolutionPhotoForViewer(viewer: PhotoViewer, photoId: string, client: PrismaClient = prisma): Promise<void> {
  const { count } = await client.evolutionPhoto.deleteMany({ where: viewerWhere(viewer, photoId) });
  if (count === 0) throw new PhotoError("NAO_ENCONTRADO", "Foto não encontrada.");
}
