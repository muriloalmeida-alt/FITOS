import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { DEFAULT_ITEMS_PER_WORKOUT, goalTenths, medalFor, nextMedal, periodOf, plannedDays, previousPeriod, type Medal, type Period, type PeriodType } from "@/shared/lib/medals";
import { OFFICIAL_STATUSES } from "./sessionScoring";

/// Conquistas (Desafios, ADR-019): meta congelada por período, pontos
/// oficiais (liberados, em contestação ou mantidos) e a medalha derivada.
/// O diário pessoal soma todos os treinos liberados (o limite de 3 por
/// semana é só do ranking).

type Scope = { tenantId: string; studentId: string };

export interface PeriodSummary {
  type: PeriodType;
  key: string;
  startsAt: Date;
  endsAt: Date;
  goalTenths: number;
  pointsTenths: number;
  medal: Medal | null;
  next: { label: string; missingTenths: number; thresholdTenths: number } | null;
  plannedDays: number;
  itemsPerWorkout: number;
}

export interface Achievements {
  week: PeriodSummary;
  month: PeriodSummary;
  /// Períodos encerrados com pontos, do mais recente ao mais antigo.
  weeks: PeriodSummary[];
  months: PeriodSummary[];
  /// Treinos do período atual com pontos esperando foto.
  pendingPhotos: number;
}

const GALLERY_WEEKS = 8;
const GALLERY_MONTHS = 6;
const DAY_MS = 86_400_000;

/// Exercícios por treino: mediana dos treinos pontuados nos 28 dias antes
/// do período; sem histórico, 5.
async function itemsPerWorkout(scope: Scope, before: Date, client: PrismaClient): Promise<number> {
  const rows = await client.sessionScore.findMany({
    where: { ...scope, performedAt: { gte: new Date(before.getTime() - 28 * DAY_MS), lt: before }, plannedItems: { gt: 0 } },
    select: { plannedItems: true },
    orderBy: { plannedItems: "asc" },
  });
  if (rows.length === 0) return DEFAULT_ITEMS_PER_WORKOUT;
  return rows[Math.floor((rows.length - 1) / 2)]!.plannedItems;
}

/// Meta do período: a já congelada ou uma nova, criada agora e congelada.
async function goalFor(scope: Scope, period: Period, preferredDays: string[], client: PrismaClient) {
  const where = { studentId_periodType_periodKey: { studentId: scope.studentId, periodType: period.type, periodKey: period.key } };
  const existing = await client.periodGoal.findUnique({ where });
  if (existing) return existing;
  const days = plannedDays(period, preferredDays);
  const items = await itemsPerWorkout(scope, period.start, client);
  const goal = goalTenths(days, items);
  if (goal <= 0) return null;
  try {
    return await client.periodGoal.create({
      data: { ...scope, periodType: period.type, periodKey: period.key, startsAt: period.start, endsAt: period.end, goalTenths: goal, plannedDays: days, itemsPerWorkout: items },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return client.periodGoal.findUnique({ where });
    throw error;
  }
}

async function officialPoints(scope: Scope, start: Date, end: Date, client: PrismaClient): Promise<number> {
  const result = await client.sessionScore.aggregate({ where: { ...scope, status: { in: OFFICIAL_STATUSES }, performedAt: { gte: start, lt: end } }, _sum: { totalTenths: true } });
  return result._sum.totalTenths ?? 0;
}

async function summarize(scope: Scope, period: Period, preferredDays: string[], client: PrismaClient): Promise<PeriodSummary> {
  const [goal, points] = await Promise.all([goalFor(scope, period, preferredDays, client), officialPoints(scope, period.start, period.end, client)]);
  const target = goal?.goalTenths ?? 0;
  const next = nextMedal(points, target);
  return {
    type: period.type,
    key: period.key,
    startsAt: period.start,
    endsAt: period.end,
    goalTenths: target,
    pointsTenths: points,
    medal: medalFor(points, target),
    next: next ? { label: next.label, missingTenths: next.missingTenths, thresholdTenths: next.thresholdTenths } : null,
    plannedDays: goal?.plannedDays ?? 0,
    itemsPerWorkout: goal?.itemsPerWorkout ?? 0,
  };
}

/// Galeria: períodos encerrados que tiveram pontos (a meta fica congelada
/// na primeira vez que o período aparece).
async function gallery(scope: Scope, type: PeriodType, current: Period, count: number, preferredDays: string[], client: PrismaClient): Promise<PeriodSummary[]> {
  const result: PeriodSummary[] = [];
  let period = previousPeriod(current);
  for (let index = 0; index < count; index++) {
    if ((await officialPoints(scope, period.start, period.end, client)) > 0) result.push(await summarize(scope, period, preferredDays, client));
    period = previousPeriod(period);
  }
  return result;
}

export async function getAchievements(input: Scope, client: PrismaClient = prisma, now = new Date()): Promise<Achievements> {
  // Só o escopo: quem chama pode passar o contexto inteiro (userId, role…).
  const scope: Scope = { tenantId: input.tenantId, studentId: input.studentId };
  const student = await client.student.findFirst({ where: { id: scope.studentId, tenantId: scope.tenantId }, select: { preferredDays: true } });
  const days = student?.preferredDays ?? [];
  const week = periodOf("SEMANA", now);
  const month = periodOf("MES", now);
  const [weekSummary, monthSummary, weeks, months, pendingPhotos] = await Promise.all([
    summarize(scope, week, days, client),
    summarize(scope, month, days, client),
    gallery(scope, "SEMANA", week, GALLERY_WEEKS, days, client),
    gallery(scope, "MES", month, GALLERY_MONTHS, days, client),
    client.sessionScore.count({ where: { ...scope, status: "PENDENTE_FOTO", photoDeadline: { gt: now }, performedAt: { gte: week.start } } }),
  ]);
  return { week: weekSummary, month: monthSummary, weeks, months, pendingPhotos };
}
