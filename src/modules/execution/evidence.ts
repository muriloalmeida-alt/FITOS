import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { PHOTO_MAX_BYTES, PhotoError, detectImageMime, type PhotoViewer } from "@/modules/media/photos";

/// Foto de evidência do treino (Fase 0, base do retroativo e da
/// gamificação): até 3 por treino, só de quem treinou e só em treino em
/// andamento ou concluído. Repetir a mesma foto no mesmo treino devolve a
/// já gravada (retry não duplica). Leitura: o próprio aluno/Livre e o
/// personal do espaço; exclusão: só quem treinou.

export const EVIDENCE_MAX_PER_SESSION = 3;

type Owner = { tenantId: string; studentId: string; userId: string };

export interface EvidenceSummary {
  id: string;
  width: number;
  height: number;
  createdAt: Date;
}

const SUMMARY = { id: true, width: true, height: true, createdAt: true } as const;

async function ownSession(owner: Owner, sessionId: string, client: PrismaClient | Prisma.TransactionClient) {
  const session = await client.workoutSession.findFirst({ where: { id: sessionId, tenantId: owner.tenantId, studentId: owner.studentId }, select: { id: true, status: true } });
  if (!session) throw new PhotoError("NAO_ENCONTRADO", "Treino não encontrado.");
  return session;
}

export async function addSessionEvidence(
  input: Owner & { sessionId: string; bytes: Uint8Array; width: number; height: number },
  client: PrismaClient = prisma
): Promise<{ evidence: EvidenceSummary; created: boolean }> {
  if (input.bytes.length === 0) throw new PhotoError("VALIDACAO", "Escolha uma foto.");
  if (input.bytes.length > PHOTO_MAX_BYTES) throw new PhotoError("VALIDACAO", "Foto grande demais. Tente outra.");
  const mimeType = detectImageMime(input.bytes);
  if (!mimeType) throw new PhotoError("VALIDACAO", "Use uma foto em JPG, PNG ou WebP.");
  const width = Math.round(input.width);
  const height = Math.round(input.height);
  if (!(width > 0 && width <= 4096 && height > 0 && height <= 4096)) throw new PhotoError("VALIDACAO", "Tamanho de foto inválido.");
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  const existing = () => client.workoutEvidencePhoto.findUnique({ where: { sessionId_sha256: { sessionId: input.sessionId, sha256 } }, select: SUMMARY });
  try {
    return await client.$transaction(async (tx) => {
      const session = await ownSession(input, input.sessionId, tx);
      if (session.status === "ABANDONADA") throw new PhotoError("VALIDACAO", "Este treino foi abandonado.");
      // Uma foto por vez por treino: o limite vale mesmo com envios em paralelo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`evidence:${session.id}`}))`;
      const same = await tx.workoutEvidencePhoto.findUnique({ where: { sessionId_sha256: { sessionId: session.id, sha256 } }, select: SUMMARY });
      if (same) return { evidence: same, created: false };
      if ((await tx.workoutEvidencePhoto.count({ where: { sessionId: session.id } })) >= EVIDENCE_MAX_PER_SESSION) {
        throw new PhotoError("VALIDACAO", `Até ${EVIDENCE_MAX_PER_SESSION} fotos por treino.`);
      }
      const evidence = await tx.workoutEvidencePhoto.create({
        data: { tenantId: input.tenantId, sessionId: session.id, uploadedById: input.userId, mimeType, width, height, sizeBytes: input.bytes.length, sha256, data: Buffer.from(input.bytes) },
        select: SUMMARY,
      });
      return { evidence, created: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const same = await existing();
      if (same) return { evidence: same, created: false };
    }
    throw error;
  }
}

export async function listSessionEvidence(owner: Pick<Owner, "tenantId" | "studentId">, sessionId: string, client: PrismaClient = prisma): Promise<EvidenceSummary[]> {
  return client.workoutEvidencePhoto.findMany({
    where: { sessionId, tenantId: owner.tenantId, session: { studentId: owner.studentId } },
    orderBy: { createdAt: "asc" },
    select: SUMMARY,
  });
}

/// Quantas fotos cada treino tem (para "Foto anexada" e para os pontos).
export async function evidenceCounts(tenantId: string, sessionIds: string[], client: PrismaClient = prisma): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await client.workoutEvidencePhoto.groupBy({ by: ["sessionId"], where: { tenantId, sessionId: { in: sessionIds } }, _count: { _all: true } });
  return new Map(rows.map((row) => [row.sessionId, row._count._all]));
}

function viewerWhere(viewer: PhotoViewer, evidenceId: string): Prisma.WorkoutEvidencePhotoWhereInput {
  return viewer.role === "ALUNO" ? { id: evidenceId, tenantId: viewer.tenantId, session: { studentId: viewer.studentId } } : { id: evidenceId, tenantId: viewer.tenantId };
}

export async function getEvidenceForViewer(viewer: PhotoViewer, evidenceId: string, client: PrismaClient = prisma) {
  return client.workoutEvidencePhoto.findFirst({ where: viewerWhere(viewer, evidenceId), select: { mimeType: true, data: true } });
}

/// Só quem treinou exclui (o personal vê, mas não apaga a evidência).
export async function deleteSessionEvidence(owner: Pick<Owner, "tenantId" | "studentId">, evidenceId: string, client: PrismaClient = prisma): Promise<{ sessionId: string; remaining: number }> {
  return client.$transaction(async (tx) => {
    const evidence = await tx.workoutEvidencePhoto.findFirst({ where: { id: evidenceId, tenantId: owner.tenantId, session: { studentId: owner.studentId } }, select: { id: true, sessionId: true } });
    if (!evidence) throw new PhotoError("NAO_ENCONTRADO", "Foto não encontrada.");
    await tx.workoutEvidencePhoto.delete({ where: { id: evidence.id } });
    return { sessionId: evidence.sessionId, remaining: await tx.workoutEvidencePhoto.count({ where: { sessionId: evidence.sessionId } }) };
  });
}

/// Quando o treino aconteceu: no retroativo, a data informada; no
/// cronômetro, o início.
export function sessionPerformedAt(session: { performedAt: Date | null; startedAt: Date }): Date {
  return session.performedAt ?? session.startedAt;
}
