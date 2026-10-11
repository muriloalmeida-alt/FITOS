import "server-only";
import { Prisma, type PrismaClient, type SessionScoreStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Contestação de pontos (Desafios 4/4, parte B; PDF "3-Gamificacao",
/// seção 06). Quem participa contesta, pelo resumo mínimo, um treino de
/// outra pessoa até 24 h depois de os pontos serem liberados. O revisor
/// mantém ou anula com justificativa; até lá os pontos continuam valendo
/// (CONTESTADO conta no placar). Treino de quem modera vai para outra
/// pessoa. Uma contestação aberta por treino, nenhuma repetida pelo mesmo
/// participante, e o autor pode recorrer uma vez de uma anulação. Toda
/// mudança fica em `ScoreEvent`, com quem fez e o porquê.

export const CONTEST_WINDOW_HOURS = 24;
export const APPEAL_WINDOW_HOURS = 48;
const HOUR_MS = 3_600_000;
const TEXT_MIN = 5;
const TEXT_MAX = 500;

export type ContestErrorKind = "VALIDACAO" | "NAO_ENCONTRADO" | "PROIBIDO" | "CONFLITO";

export class ContestError extends Error {
  constructor(
    public readonly kind: ContestErrorKind,
    message: string
  ) {
    super(message);
    this.name = "ContestError";
  }
}

export interface Participant {
  userId: string;
  tenantId: string;
  studentId: string;
}

export type ContestTarget = { context: "AMIGOS"; groupId: string } | { context: "TURMA" };

function text(value: unknown, label: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < TEXT_MIN || trimmed.length > TEXT_MAX) throw new ContestError("VALIDACAO", `${label}: de ${TEXT_MIN} a ${TEXT_MAX} letras.`);
  return trimmed;
}

/// Revisor do grupo: o organizador, ou (se o treino ou a contestação for
/// dele) quem está há mais tempo no grupo e não é parte do caso.
async function friendReviewer(groupId: string, exclude: string[], client: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const members = await client.friendGroupMember.findMany({ where: { groupId, leftAt: null }, orderBy: { joinedAt: "asc" }, select: { userId: true, role: true } });
  const candidates = [...members.filter((member) => member.role === "ORGANIZADOR"), ...members.filter((member) => member.role !== "ORGANIZADOR")];
  const reviewer = candidates.find((member) => !exclude.includes(member.userId));
  if (!reviewer) throw new ContestError("CONFLITO", "Precisa de mais alguém no grupo para analisar este caso.");
  return reviewer.userId;
}

async function ownerUserId(score: { tenantId: string; studentId: string }, client: PrismaClient | Prisma.TransactionClient): Promise<string | null> {
  return (await client.student.findFirst({ where: { id: score.studentId, tenantId: score.tenantId }, select: { userId: true } }))?.userId ?? null;
}

/// Abre uma contestação. Os pontos ficam "em contestação" e continuam valendo.
export async function openContest(opener: Participant, target: ContestTarget, sessionScoreId: string, reasonInput: unknown, client: PrismaClient = prisma, now = new Date()) {
  const reason = text(reasonInput, "Conte o motivo");
  const score = await client.sessionScore.findUnique({ where: { id: sessionScoreId }, select: { id: true, sessionId: true, tenantId: true, studentId: true, status: true, releasedAt: true, performedAt: true, totalTenths: true } });
  if (!score) throw new ContestError("NAO_ENCONTRADO", "Treino não encontrado.");
  if (score.tenantId === opener.tenantId && score.studentId === opener.studentId) throw new ContestError("VALIDACAO", "Você não contesta o próprio treino.");
  const owner = await ownerUserId(score, client);

  let reviewerUserId: string;
  let scope: { friendGroupId?: string; classTenantId?: string };
  if (target.context === "AMIGOS") {
    const [mine, theirs, season] = await Promise.all([
      client.friendGroupMember.findUnique({ where: { groupId_userId: { groupId: target.groupId, userId: opener.userId } } }),
      client.friendGroupMember.findFirst({ where: { groupId: target.groupId, tenantId: score.tenantId, studentId: score.studentId } }),
      client.friendSeason.findFirst({ where: { groupId: target.groupId, startsAt: { lte: score.performedAt }, endsAt: { gt: score.performedAt } } }),
    ]);
    // Só quem está no grupo, sobre treino de outro membro que conta numa temporada do grupo.
    if (!mine || mine.leftAt || !theirs || !season || score.performedAt < theirs.joinedAt || (theirs.leftAt && score.performedAt >= theirs.leftAt)) throw new ContestError("NAO_ENCONTRADO", "Treino não encontrado.");
    reviewerUserId = await friendReviewer(target.groupId, [opener.userId, owner ?? ""], client);
    scope = { friendGroupId: target.groupId };
  } else {
    const [mine, theirs, tenant] = await Promise.all([
      client.classRankingParticipant.findFirst({ where: { tenantId: opener.tenantId, studentId: opener.studentId, leftAt: null } }),
      client.classRankingParticipant.findFirst({ where: { tenantId: opener.tenantId, studentId: score.studentId, leftAt: null } }),
      client.tenant.findUnique({ where: { id: opener.tenantId }, select: { ownerId: true } }),
    ]);
    if (!mine || !theirs || score.tenantId !== opener.tenantId || !tenant) throw new ContestError("NAO_ENCONTRADO", "Treino não encontrado.");
    reviewerUserId = tenant.ownerId;
    scope = { classTenantId: opener.tenantId };
  }

  if (score.status === "CONTESTADO") throw new ContestError("CONFLITO", "Este treino já está em contestação.");
  if (score.status === "MANTIDO") throw new ContestError("CONFLITO", "Este treino já foi analisado e mantido.");
  if (score.status !== "LIBERADO" || !score.releasedAt) throw new ContestError("CONFLITO", "Só dá para contestar treino com pontos liberados.");
  if (now.getTime() > score.releasedAt.getTime() + CONTEST_WINDOW_HOURS * HOUR_MS) throw new ContestError("CONFLITO", `O prazo para contestar (${CONTEST_WINDOW_HOURS} h depois da liberação) acabou.`);

  try {
    return await client.$transaction(async (tx) => {
      const { count } = await tx.sessionScore.updateMany({ where: { id: score.id, status: "LIBERADO" }, data: { status: "CONTESTADO" } });
      if (count === 0) throw new ContestError("CONFLITO", "Este treino já está em contestação.");
      const contest = await tx.scoreContest.create({
        data: { sessionScoreId: score.id, sessionId: score.sessionId, context: target.context, ...scope, openedByUserId: opener.userId, reviewerUserId, reason, previousStatus: "LIBERADO" },
      });
      await tx.scoreEvent.create({ data: { sessionScoreId: score.id, kind: "CONTESTADO", totalTenths: score.totalTenths, fromStatus: "LIBERADO", toStatus: "CONTESTADO", actorId: opener.userId, reason } });
      return contest;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ContestError("CONFLITO", "Você já contestou este treino.");
    throw error;
  }
}

/// Decisão do revisor: manter (os pontos ficam) ou anular (estorno).
export async function decideContest(reviewer: { userId: string }, contestId: string, outcome: unknown, decisionInput: unknown, client: PrismaClient = prisma, now = new Date()) {
  if (outcome !== "MANTIDO" && outcome !== "ANULADO") throw new ContestError("VALIDACAO", "Escolha manter ou anular.");
  const decision = text(decisionInput, "Explique a decisão");
  const contest = await client.scoreContest.findFirst({ where: { id: contestId, reviewerUserId: reviewer.userId, status: "ABERTA" }, include: { score: { select: { totalTenths: true } } } });
  if (!contest) throw new ContestError("NAO_ENCONTRADO", "Caso não encontrado.");
  const toStatus: SessionScoreStatus = outcome;
  return client.$transaction(async (tx) => {
    const { count } = await tx.scoreContest.updateMany({ where: { id: contest.id, status: "ABERTA" }, data: { status: outcome, decision, decidedByUserId: reviewer.userId, decidedAt: now } });
    if (count === 0) throw new ContestError("CONFLITO", "Este caso já foi decidido.");
    // Se a foto saiu durante o caso, os pontos já voltaram a pendentes: a decisão só fica registrada.
    await tx.sessionScore.updateMany({ where: { id: contest.sessionScoreId, status: "CONTESTADO" }, data: { status: toStatus } });
    await tx.scoreEvent.create({ data: { sessionScoreId: contest.sessionScoreId, kind: outcome, totalTenths: contest.score.totalTenths, fromStatus: "CONTESTADO", toStatus, actorId: reviewer.userId, reason: decision } });
    return { status: outcome };
  });
}

/// Recurso do autor contra uma anulação: uma vez, em até 48 h, com outro
/// revisor quando houver (no grupo, alguém que não decidiu antes).
export async function appealContest(author: Participant, sessionScoreId: string, reasonInput: unknown, client: PrismaClient = prisma, now = new Date()) {
  const reason = text(reasonInput, "Conte por que recorre");
  const score = await client.sessionScore.findFirst({ where: { id: sessionScoreId, tenantId: author.tenantId, studentId: author.studentId }, select: { id: true, sessionId: true, status: true, totalTenths: true } });
  if (!score) throw new ContestError("NAO_ENCONTRADO", "Treino não encontrado.");
  const last = await client.scoreContest.findFirst({ where: { sessionScoreId, status: "ANULADO" }, orderBy: { decidedAt: "desc" } });
  if (score.status !== "ANULADO" || !last || last.isAppeal) throw new ContestError("CONFLITO", "Só dá para recorrer uma vez de uma anulação.");
  if (now.getTime() > last.decidedAt!.getTime() + APPEAL_WINDOW_HOURS * HOUR_MS) throw new ContestError("CONFLITO", `O prazo para recorrer (${APPEAL_WINDOW_HOURS} h depois da decisão) acabou.`);
  // Recurso no grupo: alguém que não seja parte do caso (autor, quem contestou, quem decidiu);
  // sem ninguém assim, volta para quem decidiu reexaminar.
  const reviewerUserId = last.context === "AMIGOS" ? await friendReviewer(last.friendGroupId!, [author.userId, last.openedByUserId, last.decidedByUserId!], client).catch(() => last.reviewerUserId) : last.reviewerUserId;
  try {
    return await client.$transaction(async (tx) => {
      const { count } = await tx.sessionScore.updateMany({ where: { id: score.id, status: "ANULADO" }, data: { status: "CONTESTADO" } });
      if (count === 0) throw new ContestError("CONFLITO", "Este treino já está em análise.");
      const contest = await tx.scoreContest.create({
        data: { sessionScoreId: score.id, sessionId: score.sessionId, context: last.context, friendGroupId: last.friendGroupId, classTenantId: last.classTenantId, openedByUserId: author.userId, reviewerUserId, reason, previousStatus: "ANULADO", isAppeal: true },
      });
      await tx.scoreEvent.create({ data: { sessionScoreId: score.id, kind: "RECURSO", totalTenths: score.totalTenths, fromStatus: "ANULADO", toStatus: "CONTESTADO", actorId: author.userId, reason } });
      return contest;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ContestError("CONFLITO", "Só dá para recorrer uma vez de uma anulação.");
    throw error;
  }
}

export interface ReviewCase {
  id: string;
  context: "AMIGOS" | "TURMA";
  where: string;
  isAppeal: boolean;
  ownerName: string;
  performedAt: Date;
  pointsTenths: number;
  reason: string;
  openedAt: Date;
  evidenceIds: string[];
}

/// Casos abertos para quem revisa (resumo mínimo + foto).
export async function listReviewQueue(reviewer: { userId: string }, filter: ContestTarget | null = null, client: PrismaClient = prisma): Promise<ReviewCase[]> {
  const contests = await client.scoreContest.findMany({
    where: { reviewerUserId: reviewer.userId, status: "ABERTA", ...(filter ? (filter.context === "AMIGOS" ? { friendGroupId: filter.groupId } : { context: "TURMA" }) : {}) },
    orderBy: { createdAt: "asc" },
    include: { score: { select: { tenantId: true, studentId: true, performedAt: true, totalTenths: true, session: { select: { evidences: { select: { id: true } }, student: { select: { displayName: true, user: { select: { name: true } } } } } } } } },
  });
  const groups = new Map((await client.friendGroup.findMany({ where: { id: { in: contests.map((contest) => contest.friendGroupId).filter((id): id is string => Boolean(id)) } }, select: { id: true, name: true } })).map((group) => [group.id, group.name]));
  return contests.map((contest) => ({
    id: contest.id,
    context: contest.context as "AMIGOS" | "TURMA",
    where: contest.context === "AMIGOS" ? (groups.get(contest.friendGroupId!) ?? "Grupo") : "Ranking da turma",
    isAppeal: contest.isAppeal,
    ownerName: contest.score.session.student.user?.name || contest.score.session.student.displayName || "Participante",
    performedAt: contest.score.performedAt,
    pointsTenths: contest.score.totalTenths,
    reason: contest.reason,
    openedAt: contest.createdAt,
    evidenceIds: contest.score.session.evidences.map((evidence) => evidence.id),
  }));
}

/// O revisor de um caso aberto vê a foto do treino contestado (mesmo de outro espaço).
export async function evidenceForReviewer(reviewer: { userId: string }, evidenceId: string, client: PrismaClient = prisma) {
  return client.workoutEvidencePhoto.findFirst({
    where: { id: evidenceId, session: { score: { contests: { some: { reviewerUserId: reviewer.userId, status: "ABERTA" } } } } },
    select: { mimeType: true, data: true },
  });
}

export interface AuthorContestState {
  status: "ABERTA" | "MANTIDO" | "ANULADO";
  isAppeal: boolean;
  decision: string | null;
  canAppeal: boolean;
}

/// O que o autor vê do caso do próprio treino (sem saber quem contestou).
export async function contestStateForAuthor(scope: { tenantId: string; studentId: string }, sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<AuthorContestState | null> {
  const last = await client.scoreContest.findFirst({ where: { sessionId, score: { tenantId: scope.tenantId, studentId: scope.studentId } }, orderBy: { createdAt: "desc" } });
  if (!last) return null;
  const canAppeal = last.status === "ANULADO" && !last.isAppeal && now.getTime() <= last.decidedAt!.getTime() + APPEAL_WINDOW_HOURS * HOUR_MS;
  return { status: last.status as AuthorContestState["status"], isAppeal: last.isAppeal, decision: last.decision, canAppeal };
}

export interface ContestableWorkout {
  scoreId: string;
  performedAt: Date;
  pointsTenths: number;
  status: SessionScoreStatus;
  contestable: boolean;
}

/// Resumo mínimo dos treinos de alguém num período (data e pontos), com o
/// que ainda dá para contestar.
export async function workoutsForContest(owner: { tenantId: string; studentId: string }, window: { from: Date; until: Date }, client: PrismaClient = prisma, now = new Date()): Promise<ContestableWorkout[]> {
  const scores = await client.sessionScore.findMany({
    where: { tenantId: owner.tenantId, studentId: owner.studentId, status: { in: ["LIBERADO", "CONTESTADO", "MANTIDO", "ANULADO"] }, performedAt: { gte: window.from, lt: window.until } },
    orderBy: { performedAt: "desc" },
    select: { id: true, performedAt: true, totalTenths: true, status: true, releasedAt: true },
  });
  return scores.map((score) => ({
    scoreId: score.id,
    performedAt: score.performedAt,
    pointsTenths: score.totalTenths,
    status: score.status,
    contestable: score.status === "LIBERADO" && score.releasedAt !== null && now.getTime() <= score.releasedAt.getTime() + CONTEST_WINDOW_HOURS * HOUR_MS,
  }));
}
