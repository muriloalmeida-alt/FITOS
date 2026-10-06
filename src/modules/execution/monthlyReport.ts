import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Relatório do mês (EPIC-45): o que o aluno fez no mês, comparado ao
/// anterior — treinos, dias, tempo, volume, recordes, as cargas que mais
/// subiram, peso/gordura e as fotos do mês. Mesmo relatório para o aluno,
/// o Livre e o personal (vendo um aluno).

export interface MonthlyReport {
  month: string;
  label: string;
  sessions: number;
  days: number;
  activeMinutes: number;
  sets: number;
  volumeKg: number;
  previous: { sessions: number; volumeKg: number };
  records: { exerciseName: string; loadKg: number }[];
  gains: { exerciseName: string; fromKg: number; toKg: number }[];
  body: { weightFrom: number | null; weightTo: number | null; fatFrom: number | null; fatTo: number | null } | null;
  photos: { id: string; pose: string; takenAt: Date }[];
  firstMonth: string | null;
}

/// Mês "AAAA-MM" válido, ou o mês atual (em Brasília).
export function parseMonth(value: string | null | undefined, now = new Date()): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const local = new Date(now.getTime() - 3 * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/// Início do mês em Brasília (UTC−3, sem horário de verão desde 2019).
function monthStart(month: string): Date {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1, 1, 3));
}

export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const dayKey = (date: Date) => new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
const kg = (grams: number) => Math.round(grams / 100) / 10;

export async function getMonthlyReport(input: { tenantId: string; studentId: string; month: string }, client: PrismaClient = prisma): Promise<MonthlyReport> {
  const scope = { tenantId: input.tenantId, studentId: input.studentId };
  const from = monthStart(input.month);
  const to = monthStart(shiftMonth(input.month, 1));
  const previousFrom = monthStart(shiftMonth(input.month, -1));

  const [sessions, previous, before, assessments, photos, first] = await Promise.all([
    client.workoutSession.findMany({
      where: { ...scope, status: "CONCLUIDA", startedAt: { gte: from, lt: to } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true, endedAt: true, activeSeconds: true, setResults: { select: { reps: true, loadGrams: true, performedExerciseId: true, workoutExercise: { select: { exerciseId: true, exercise: { select: { name: true } } } } } } },
    }),
    client.workoutSession.findMany({
      where: { ...scope, status: "CONCLUIDA", startedAt: { gte: previousFrom, lt: from } },
      select: { setResults: { select: { reps: true, loadGrams: true } } },
    }),
    client.workoutSetResult.groupBy({
      by: ["workoutExerciseId"],
      where: { tenantId: input.tenantId, performedExerciseId: null, loadGrams: { gt: 0 }, workoutSession: { studentId: input.studentId, status: "CONCLUIDA", startedAt: { lt: from } } },
      _max: { loadGrams: true },
    }),
    client.assessment.findMany({ where: { ...scope, deletedAt: null, recordedAt: { lt: to } }, orderBy: { recordedAt: "asc" }, select: { recordedAt: true, weightGrams: true, bodyFatTenthPercent: true } }),
    client.evolutionPhoto.findMany({ where: { ...scope, takenAt: { gte: from, lt: to } }, orderBy: { takenAt: "asc" }, select: { id: true, pose: true, takenAt: true } }),
    client.workoutSession.findFirst({ where: { ...scope, status: "CONCLUIDA" }, orderBy: { startedAt: "asc" }, select: { startedAt: true } }),
  ]);

  const volume = (rows: { reps: number | null; loadGrams: number | null }[]) => rows.reduce((sum, row) => sum + (row.reps ?? 0) * (row.loadGrams ?? 0), 0);

  // Recorde do mês: carga acima de tudo que veio antes, por exercício.
  const beforeItems = before.length ? await client.workoutExercise.findMany({ where: { id: { in: before.map((row) => row.workoutExerciseId) } }, select: { id: true, exerciseId: true } }) : [];
  const bestBefore = new Map<string, number>();
  for (const row of before) {
    const exerciseId = beforeItems.find((item) => item.id === row.workoutExerciseId)?.exerciseId;
    if (exerciseId) bestBefore.set(exerciseId, Math.max(bestBefore.get(exerciseId) ?? 0, row._max.loadGrams ?? 0));
  }
  const byExercise = new Map<string, { name: string; first: number; last: number; best: number }>();
  for (const session of sessions) {
    const top = new Map<string, { name: string; load: number }>();
    for (const set of session.setResults) {
      if (set.performedExerciseId || !set.loadGrams) continue;
      const id = set.workoutExercise.exerciseId;
      const current = top.get(id);
      if (!current || set.loadGrams > current.load) top.set(id, { name: set.workoutExercise.exercise.name, load: set.loadGrams });
    }
    for (const [id, { name, load }] of top) {
      const entry = byExercise.get(id);
      if (!entry) byExercise.set(id, { name, first: load, last: load, best: load });
      else byExercise.set(id, { ...entry, last: load, best: Math.max(entry.best, load) });
    }
  }
  const records = [...byExercise.entries()]
    .filter(([id, entry]) => bestBefore.has(id) && entry.best > bestBefore.get(id)!)
    .map(([, entry]) => ({ exerciseName: entry.name, loadKg: kg(entry.best) }))
    .sort((a, b) => b.loadKg - a.loadKg);
  const gains = [...byExercise.values()]
    .filter((entry) => entry.last > entry.first)
    .sort((a, b) => b.last - b.first - (a.last - a.first))
    .slice(0, 3)
    .map((entry) => ({ exerciseName: entry.name, fromKg: kg(entry.first), toKg: kg(entry.last) }));

  // Corpo: última medida antes do mês (ou a primeira do mês) → última do mês.
  const inMonth = assessments.filter((row) => row.recordedAt >= from);
  const start = assessments.filter((row) => row.recordedAt < from).at(-1) ?? inMonth[0] ?? null;
  const end = inMonth.at(-1) ?? null;
  const body =
    end && start && end !== start
      ? {
          weightFrom: start.weightGrams !== null ? kg(start.weightGrams) : null,
          weightTo: end.weightGrams !== null ? kg(end.weightGrams) : null,
          fatFrom: start.bodyFatTenthPercent !== null ? start.bodyFatTenthPercent / 10 : null,
          fatTo: end.bodyFatTenthPercent !== null ? end.bodyFatTenthPercent / 10 : null,
        }
      : end
        ? { weightFrom: null, weightTo: end.weightGrams !== null ? kg(end.weightGrams) : null, fatFrom: null, fatTo: end.bodyFatTenthPercent !== null ? end.bodyFatTenthPercent / 10 : null }
        : null;

  // Fotos: a primeira e a última de frente do mês (ou as duas primeiras).
  const front = photos.filter((photo) => photo.pose === "FRENTE");
  const chosen = front.length >= 2 ? [front[0]!, front.at(-1)!] : photos.slice(0, 2);

  const allSets = sessions.flatMap((session) => session.setResults);
  return {
    month: input.month,
    label: monthLabel(input.month),
    sessions: sessions.length,
    days: new Set(sessions.map((session) => dayKey(session.startedAt))).size,
    activeMinutes: Math.round(sessions.reduce((sum, session) => sum + (session.activeSeconds ?? (session.endedAt ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000 : 0)), 0) / 60),
    sets: allSets.length,
    volumeKg: Math.round(volume(allSets) / 1000),
    previous: { sessions: previous.length, volumeKg: Math.round(volume(previous.flatMap((session) => session.setResults)) / 1000) },
    records,
    gains,
    body,
    photos: chosen,
    firstMonth: first ? parseMonth(null, first.startedAt) : null,
  };
}
