import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { addDays, dayLabel, formatTime, isDate, localDate, toInstant, weekdayOf } from "@/shared/lib/scheduleTime";

/// Agenda (EPIC-48): horários fixos por aluno e o que acontece em cada dia
/// — aula feita, falta, desmarcada, remarcada ou avulsa. Uma ocorrência do
/// horário fixo só vira registro quando muda de situação; aulas avulsas e
/// reposições são registros próprios.

export class ScheduleError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

export const OCCURRENCE_STATUSES = ["AGENDADA", "FEITA", "FALTA", "DESMARCADA"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export interface Occurrence {
  /// "slot:<id>:<data>" ou "event:<id>".
  ref: string;
  studentId: string;
  studentName: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  location: string | null;
  status: OccurrenceStatus;
  note: string | null;
  extra: boolean;
}

type Deps = { client?: PrismaClient; sender?: Sender; config?: PushConfig | null; now?: Date };

const MAX_RANGE_DAYS = 62;

function validTimes(startMinutes: unknown, durationMinutes: unknown): { start: number; duration: number } {
  const start = typeof startMinutes === "number" ? startMinutes : NaN;
  const duration = typeof durationMinutes === "number" ? durationMinutes : 60;
  if (!Number.isInteger(start) || start < 0 || start > 23 * 60 + 55 || start % 5 !== 0) throw new ScheduleError("VALIDACAO", "Horário inválido.");
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) throw new ScheduleError("VALIDACAO", "Duração de 15 min a 4 h.");
  return { start, duration };
}

async function activeStudent(client: PrismaClient, tenantId: string, studentId: unknown) {
  const student = typeof studentId === "string" ? await client.student.findFirst({ where: { id: studentId, tenantId, status: "ATIVO" }, select: { id: true, displayName: true, userId: true } }) : null;
  if (!student) throw new ScheduleError("NAO_ENCONTRADO", "Aluno não encontrado.");
  return student;
}

export async function listOccurrences(input: { tenantId: string; from: string; to: string; studentId?: string }, client: PrismaClient = prisma): Promise<Occurrence[]> {
  if (!isDate(input.from) || !isDate(input.to) || input.to < input.from || addDays(input.from, MAX_RANGE_DAYS) < input.to) throw new ScheduleError("VALIDACAO", "Período inválido.");
  const studentFilter = input.studentId ? { studentId: input.studentId } : {};
  const [slots, events] = await Promise.all([
    client.scheduleSlot.findMany({
      where: { tenantId: input.tenantId, ...studentFilter, startsOn: { lte: input.to }, student: { status: "ATIVO" }, OR: [{ active: true }, { endedAt: { gte: toInstant(input.from, 0) } }] },
      include: { student: { select: { displayName: true } } },
    }),
    client.scheduleEvent.findMany({
      where: { tenantId: input.tenantId, ...studentFilter, OR: [{ slotId: null, date: { gte: input.from, lte: input.to } }, { slotId: { not: null }, originalDate: { gte: input.from, lte: input.to } }] },
      include: { student: { select: { displayName: true, status: true } } },
    }),
  ]);
  const overrides = new Map(events.filter((event) => event.slotId).map((event) => [`${event.slotId}:${event.originalDate}`, event]));
  const out: Occurrence[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    for (const slot of slots) {
      if (slot.weekday !== weekday || date < slot.startsOn) continue;
      if (!slot.active && slot.endedAt && localDate(slot.endedAt) <= date) continue;
      const override = overrides.get(`${slot.id}:${date}`);
      out.push({
        ref: `slot:${slot.id}:${date}`,
        studentId: slot.studentId,
        studentName: slot.student.displayName,
        date,
        startMinutes: slot.startMinutes,
        durationMinutes: slot.durationMinutes,
        location: slot.location,
        status: (override?.status as OccurrenceStatus) ?? "AGENDADA",
        note: override?.note ?? null,
        extra: false,
      });
    }
  }
  for (const event of events) {
    if (event.slotId || event.student.status !== "ATIVO") continue;
    out.push({ ref: `event:${event.id}`, studentId: event.studentId, studentName: event.student.displayName, date: event.date, startMinutes: event.startMinutes, durationMinutes: event.durationMinutes, location: null, status: event.status as OccurrenceStatus, note: event.note, extra: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.studentName.localeCompare(b.studentName, "pt-BR"));
}

/// Horário fixo: um registro por dia da semana escolhido.
export async function createSlots(
  input: { tenantId: string; studentId: unknown; weekdays: unknown; startMinutes: unknown; durationMinutes?: unknown; location?: unknown; now?: Date },
  client: PrismaClient = prisma
): Promise<{ ids: string[] }> {
  const student = await activeStudent(client, input.tenantId, input.studentId);
  const weekdays = Array.isArray(input.weekdays) ? [...new Set(input.weekdays)].filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6) : [];
  if (weekdays.length === 0) throw new ScheduleError("VALIDACAO", "Escolha os dias.");
  const { start, duration } = validTimes(input.startMinutes, input.durationMinutes);
  const location = typeof input.location === "string" && input.location.trim() ? input.location.trim().slice(0, 80) : null;
  const startsOn = localDate(input.now ?? new Date());
  const ids: string[] = [];
  for (const weekday of weekdays.sort()) {
    const slot = await client.scheduleSlot.create({ data: { tenantId: input.tenantId, studentId: student.id, weekday, startMinutes: start, durationMinutes: duration, location, startsOn } });
    ids.push(slot.id);
  }
  return { ids };
}

export async function endSlot(input: { tenantId: string; slotId: string; now?: Date }, client: PrismaClient = prisma): Promise<void> {
  const { count } = await client.scheduleSlot.updateMany({ where: { id: input.slotId, tenantId: input.tenantId, active: true }, data: { active: false, endedAt: input.now ?? new Date() } });
  if (count === 0) throw new ScheduleError("NAO_ENCONTRADO", "Horário não encontrado.");
}

export async function listSlots(input: { tenantId: string; studentId?: string }, client: PrismaClient = prisma) {
  return client.scheduleSlot.findMany({ where: { tenantId: input.tenantId, active: true, ...(input.studentId ? { studentId: input.studentId } : {}) }, orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }], include: { student: { select: { displayName: true } } } });
}

type Resolved = { kind: "slot"; slotId: string; date: string; studentId: string; startMinutes: number; durationMinutes: number } | { kind: "event"; eventId: string; date: string; studentId: string; startMinutes: number; durationMinutes: number };

/// Acha a ocorrência pela referência, no espaço (e do aluno, se for ele).
async function resolve(client: PrismaClient, tenantId: string, ref: unknown, studentId?: string): Promise<Resolved> {
  const text = typeof ref === "string" ? ref : "";
  const slotMatch = /^slot:([a-z0-9]+):(\d{4}-\d{2}-\d{2})$/.exec(text);
  if (slotMatch) {
    const [, slotId, date] = slotMatch as unknown as [string, string, string];
    const slot = await client.scheduleSlot.findFirst({ where: { id: slotId, tenantId, ...(studentId ? { studentId } : {}) } });
    if (slot && isDate(date) && weekdayOf(date) === slot.weekday && date >= slot.startsOn && (slot.active || (slot.endedAt && localDate(slot.endedAt) > date))) {
      return { kind: "slot", slotId: slot.id, date, studentId: slot.studentId, startMinutes: slot.startMinutes, durationMinutes: slot.durationMinutes };
    }
  }
  const eventMatch = /^event:([a-z0-9]+)$/.exec(text);
  if (eventMatch) {
    const event = await client.scheduleEvent.findFirst({ where: { id: eventMatch[1], tenantId, slotId: null, ...(studentId ? { studentId } : {}) } });
    if (event) return { kind: "event", eventId: event.id, date: event.date, studentId: event.studentId, startMinutes: event.startMinutes, durationMinutes: event.durationMinutes };
  }
  throw new ScheduleError("NAO_ENCONTRADO", "Aula não encontrada.");
}

async function writeStatus(client: PrismaClient, tenantId: string, target: Resolved, status: OccurrenceStatus, note: string | null, actorUserId: string) {
  if (target.kind === "slot") {
    await client.scheduleEvent.upsert({
      where: { slotId_originalDate: { slotId: target.slotId, originalDate: target.date } },
      create: { tenantId, studentId: target.studentId, slotId: target.slotId, originalDate: target.date, date: target.date, startMinutes: target.startMinutes, durationMinutes: target.durationMinutes, status, note, updatedByUserId: actorUserId },
      update: { status, note, updatedByUserId: actorUserId },
    });
  } else {
    await client.scheduleEvent.update({ where: { id: target.eventId }, data: { status, note, updatedByUserId: actorUserId } });
  }
}

async function push(client: PrismaClient, deps: Deps, userId: string | null, payload: { title: string; body: string; url: string }) {
  if (!userId) return;
  try {
    await sendToUser(userId, { ...payload, tag: `agenda-${userId}` }, { client, sender: deps.sender, config: deps.config });
  } catch (error) {
    logEvent("error", "agenda_push_falhou", describeError(error));
  }
}

const when = (date: string, minutes: number) => `${dayLabel(date)} às ${formatTime(minutes)}`;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/// O personal marca a situação da aula (feita, falta, desmarcada, ou volta
/// para agendada). Desmarcar avisa o aluno.
export async function setOccurrenceStatus(input: { tenantId: string; actorUserId: string; ref: unknown; status: unknown; note?: unknown }, deps: Deps = {}): Promise<void> {
  const client = deps.client ?? prisma;
  if (!OCCURRENCE_STATUSES.includes(input.status as OccurrenceStatus)) throw new ScheduleError("VALIDACAO", "Situação inválida.");
  const status = input.status as OccurrenceStatus;
  const target = await resolve(client, input.tenantId, input.ref);
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 200) : null;
  await writeStatus(client, input.tenantId, target, status, note, input.actorUserId);
  if (status === "DESMARCADA") {
    const student = await client.student.findUniqueOrThrow({ where: { id: target.studentId }, select: { userId: true, tenant: { select: { owner: { select: { name: true } } } } } });
    await push(client, deps, student.userId, { title: `${first(student.tenant.owner.name)} desmarcou a aula`, body: `${when(target.date, target.startMinutes)}${note ? ` · ${note}` : ""}`, url: "/painel/agenda" });
  }
}

/// Aula avulsa ou reposição.
export async function createExtra(
  input: { tenantId: string; actorUserId: string; studentId: unknown; date: unknown; startMinutes: unknown; durationMinutes?: unknown; note?: unknown },
  deps: Deps = {}
): Promise<{ ref: string }> {
  const client = deps.client ?? prisma;
  const student = await activeStudent(client, input.tenantId, input.studentId);
  if (!isDate(input.date)) throw new ScheduleError("VALIDACAO", "Data inválida.");
  const { start, duration } = validTimes(input.startMinutes, input.durationMinutes);
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 200) : null;
  const event = await client.scheduleEvent.create({ data: { tenantId: input.tenantId, studentId: student.id, date: input.date, startMinutes: start, durationMinutes: duration, note, updatedByUserId: input.actorUserId } });
  const owner = await client.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { owner: { select: { name: true } } } });
  await push(client, deps, student.userId, { title: `Aula marcada com ${first(owner.owner.name)}`, body: when(input.date, start), url: "/painel/agenda" });
  return { ref: `event:${event.id}` };
}

/// Remarcar: a aula original fica desmarcada ("remarcada para…") e nasce a
/// reposição no novo dia e hora.
export async function rescheduleOccurrence(input: { tenantId: string; actorUserId: string; ref: unknown; date: unknown; startMinutes: unknown }, deps: Deps = {}): Promise<{ ref: string }> {
  const client = deps.client ?? prisma;
  const target = await resolve(client, input.tenantId, input.ref);
  if (!isDate(input.date)) throw new ScheduleError("VALIDACAO", "Data inválida.");
  const { start } = validTimes(input.startMinutes, target.durationMinutes);
  const event = await client.$transaction(async (tx) => {
    await writeStatus(tx as unknown as PrismaClient, input.tenantId, target, "DESMARCADA", `Remarcada para ${when(input.date as string, start)}`, input.actorUserId);
    return tx.scheduleEvent.create({ data: { tenantId: input.tenantId, studentId: target.studentId, date: input.date as string, startMinutes: start, durationMinutes: target.durationMinutes, note: `Reposição de ${dayLabel(target.date)}`, updatedByUserId: input.actorUserId } });
  });
  const student = await client.student.findUniqueOrThrow({ where: { id: target.studentId }, select: { userId: true, tenant: { select: { owner: { select: { name: true } } } } } });
  await push(client, deps, student.userId, { title: `${first(student.tenant.owner.name)} remarcou a aula`, body: `${when(target.date, target.startMinutes)} → ${when(input.date, start)}`, url: "/painel/agenda" });
  return { ref: `event:${event.id}` };
}

/// O aluno avisa que não vai (só aulas que ainda não começaram). O
/// personal recebe o aviso.
export async function studentCancel(input: { tenantId: string; studentId: string; userId: string; ref: unknown; reason?: unknown }, deps: Deps = {}): Promise<void> {
  const client = deps.client ?? prisma;
  const target = await resolve(client, input.tenantId, input.ref, input.studentId);
  if (toInstant(target.date, target.startMinutes) <= (deps.now ?? new Date())) throw new ScheduleError("VALIDACAO", "Essa aula já começou.");
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, 200) : null;
  await writeStatus(client, input.tenantId, target, "DESMARCADA", reason ? `Aluno avisou: ${reason}` : "Aluno avisou que não vai", input.userId);
  const student = await client.student.findUniqueOrThrow({ where: { id: input.studentId }, select: { displayName: true, tenant: { select: { ownerId: true } } } });
  await push(client, deps, student.tenant.ownerId, { title: `${first(student.displayName)} não vai na aula`, body: `${when(target.date, target.startMinutes)}${reason ? ` · ${reason}` : ""}`, url: `/painel/agenda?semana=${target.date}` });
}

/// Próximas aulas do aluno (as que ainda não terminaram).
export async function nextOccurrencesForStudent(input: { tenantId: string; studentId: string; now?: Date; days?: number; limit?: number }, client: PrismaClient = prisma): Promise<Occurrence[]> {
  const now = input.now ?? new Date();
  const today = localDate(now);
  const list = await listOccurrences({ tenantId: input.tenantId, studentId: input.studentId, from: today, to: addDays(today, input.days ?? 14) }, client);
  return list.filter((item) => toInstant(item.date, item.startMinutes + item.durationMinutes) > now).slice(0, input.limit ?? 5);
}
