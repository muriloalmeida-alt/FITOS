import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { workoutsForContest, type ContestableWorkout } from "./scoreContests";
import { periodOf, type PeriodType } from "@/shared/lib/medals";
import { rankStudents, type RankingEntry } from "@/shared/lib/ranking";
import { OFFICIAL_STATUSES } from "./sessionScoring";

/// Ranking da turma do personal (Desafios, ADR-019): ligado pelo personal,
/// adesão voluntária do aluno, modo equilibrado com 3 melhores treinos por
/// semana. Visível só ao personal e aos alunos ativos que aderiram; mostra
/// nome, foto e pontos (nunca cargas, programa ou saúde). Não importa
/// treinos de antes da ativação nem da adesão.

export class RankingError extends Error {
  constructor(
    public readonly kind: "DESLIGADO" | "PROIBIDO",
    message: string
  ) {
    super(message);
    this.name = "RankingError";
  }
}

export interface ClassRankingState {
  enabled: boolean;
  activatedAt: Date | null;
}

export async function getClassRankingState(tenantId: string, client: PrismaClient = prisma): Promise<ClassRankingState> {
  const row = await client.classRanking.findUnique({ where: { tenantId } });
  return { enabled: row?.enabled ?? false, activatedAt: row?.activatedAt ?? null };
}

/// Ligar começa uma temporada nova (conta a partir de agora); desligar só
/// para de mostrar, sem apagar nada.
export async function setClassRankingEnabled(tenantId: string, enabled: boolean, client: PrismaClient = prisma, now = new Date()): Promise<ClassRankingState> {
  const current = await getClassRankingState(tenantId, client);
  if (current.enabled === enabled) return current;
  const row = await client.classRanking.upsert({
    where: { tenantId },
    create: { tenantId, enabled, activatedAt: enabled ? now : null, deactivatedAt: enabled ? null : now },
    update: enabled ? { enabled, activatedAt: now, deactivatedAt: null } : { enabled, deactivatedAt: now },
  });
  return { enabled: row.enabled, activatedAt: row.activatedAt };
}

type StudentScope = { tenantId: string; studentId: string };

export async function isParticipant(scope: StudentScope, client: PrismaClient = prisma): Promise<boolean> {
  const row = await client.classRankingParticipant.findUnique({ where: { studentId: scope.studentId } });
  return Boolean(row && row.tenantId === scope.tenantId && !row.leftAt);
}

export async function joinClassRanking(scope: StudentScope, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  if (!(await getClassRankingState(scope.tenantId, client)).enabled) throw new RankingError("DESLIGADO", "O ranking da turma não está ligado.");
  const existing = await client.classRankingParticipant.findUnique({ where: { studentId: scope.studentId } });
  if (existing && !existing.leftAt) return;
  await client.classRankingParticipant.upsert({
    where: { studentId: scope.studentId },
    create: { tenantId: scope.tenantId, studentId: scope.studentId, joinedAt: now },
    update: { joinedAt: now, leftAt: null },
  });
}

export async function leaveClassRanking(scope: StudentScope, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  await client.classRankingParticipant.updateMany({ where: { studentId: scope.studentId, tenantId: scope.tenantId, leftAt: null }, data: { leftAt: now } });
}

export interface ClassRankingRow {
  studentId: string;
  name: string;
  image: string | null;
  position: number;
  pointsTenths: number;
  counted: number;
  contested: boolean;
  isMe: boolean;
}

export type RankingViewer = { role: "PERSONAL"; tenantId: string } | { role: "ALUNO"; tenantId: string; studentId: string };

export async function getClassRanking(viewer: RankingViewer, type: PeriodType, client: PrismaClient = prisma, now = new Date()): Promise<{ startsAt: Date; endsAt: Date; rows: ClassRankingRow[] }> {
  const state = await getClassRankingState(viewer.tenantId, client);
  if (!state.enabled || !state.activatedAt) throw new RankingError("DESLIGADO", "O ranking da turma não está ligado.");
  if (viewer.role === "ALUNO" && !(await isParticipant(viewer, client))) throw new RankingError("PROIBIDO", "Entre no ranking da turma para ver a classificação.");

  const participants = await client.classRankingParticipant.findMany({
    where: { tenantId: viewer.tenantId, leftAt: null, student: { status: "ATIVO" } },
    select: { studentId: true, joinedAt: true, student: { select: { displayName: true, user: { select: { image: true } } } } },
  });
  const period = periodOf(type, now);
  const scores = await client.sessionScore.findMany({
    where: {
      tenantId: viewer.tenantId,
      studentId: { in: participants.map((participant) => participant.studentId) },
      status: { in: OFFICIAL_STATUSES },
      performedAt: { gte: period.start, lt: period.end },
    },
    select: { studentId: true, performedAt: true, balancedTenths: true, status: true },
  });
  // Só conta o que foi feito depois da ativação e da adesão de cada um.
  const since = new Map(participants.map((participant) => [participant.studentId, Math.max(participant.joinedAt.getTime(), state.activatedAt!.getTime())]));
  const entries: RankingEntry[] = scores
    .filter((score) => score.performedAt.getTime() >= (since.get(score.studentId) ?? Infinity))
    .map((score) => ({ studentId: score.studentId, performedAt: score.performedAt, balancedTenths: score.balancedTenths, contested: score.status === "CONTESTADO" }));
  const byId = new Map(participants.map((participant) => [participant.studentId, participant.student]));
  const rows = rankStudents(participants.map((participant) => participant.studentId), entries, period).map((row) => ({
    ...row,
    name: byId.get(row.studentId)?.displayName ?? "Aluno",
    image: byId.get(row.studentId)?.user?.image ?? null,
    isMe: viewer.role === "ALUNO" && viewer.studentId === row.studentId,
  }));
  return { startsAt: period.start, endsAt: period.end, rows };
}

/// Aluno que participa: treinos dos colegas no período (data e pontos),
/// para contestar pelo resumo mínimo.
export async function classMemberWorkouts(viewer: { tenantId: string; studentId: string }, type: PeriodType, client: PrismaClient = prisma, now = new Date()): Promise<Map<string, ContestableWorkout[]>> {
  const result = new Map<string, ContestableWorkout[]>();
  const state = await getClassRankingState(viewer.tenantId, client);
  if (!state.enabled || !state.activatedAt || !(await isParticipant(viewer, client))) return result;
  const period = periodOf(type, now);
  const participants = await client.classRankingParticipant.findMany({ where: { tenantId: viewer.tenantId, leftAt: null, studentId: { not: viewer.studentId }, student: { status: "ATIVO" } } });
  for (const participant of participants) {
    const from = new Date(Math.max(period.start.getTime(), participant.joinedAt.getTime(), state.activatedAt.getTime()));
    if (from < period.end) result.set(participant.studentId, await workoutsForContest({ tenantId: viewer.tenantId, studentId: participant.studentId }, { from, until: period.end }, client, now));
  }
  return result;
}
