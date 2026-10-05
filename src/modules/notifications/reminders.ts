import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { sendToUser, type PushConfig, type Sender } from "./push";

/// Lembrete de treino (EPIC-31). A cada rodada (o agendador roda de poucos
/// em poucos minutos), quem marcou o lembrete para a hora atual de Brasília
/// recebe um aviso se hoje é dia de treino e ainda não treinou. Cada
/// pessoa recebe no máximo um por dia: o dia é "reservado" com um
/// `updateMany` condicional antes de enviar, então duas instâncias nunca
/// mandam em dobro.

const TIME_ZONE = "America/Sao_Paulo";
const WEEKDAY_BY_EN: Record<string, string> = { Mon: "SEGUNDA", Tue: "TERCA", Wed: "QUARTA", Thu: "QUINTA", Fri: "SEXTA", Sat: "SABADO", Sun: "DOMINGO" };

export function localClock(now: Date): { hour: number; dateKey: string; weekday: string; dayStart: Date } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  // Brasília não tem horário de verão desde 2019: UTC−3 o ano todo.
  return { hour: Number.parseInt(parts.hour!, 10), dateKey, weekday: WEEKDAY_BY_EN[parts.weekday!]!, dayStart: new Date(`${dateKey}T00:00:00-03:00`) };
}

export const REMINDER_HOURS = [6, 7, 8, 12, 17, 18, 19, 20] as const;

export async function getReminderHour(userId: string, client: PrismaClient = prisma): Promise<number | null> {
  return (await client.notificationSettings.findUnique({ where: { userId } }))?.reminderHour ?? null;
}

export async function setReminderHour(userId: string, hour: number | null, client: PrismaClient = prisma): Promise<void> {
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) throw new Error("Hora inválida.");
  await client.notificationSettings.upsert({ where: { userId }, create: { userId, reminderHour: hour }, update: { reminderHour: hour } });
}

interface TodayPlan {
  studentId: string;
  tenantId: string;
  workoutName: string | null;
}

/// O que a pessoa tem para hoje: `null` se hoje não é dia de treino dela.
async function todayFor(userId: string, weekday: string, client: PrismaClient): Promise<TodayPlan | null> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, ownedTenant: { select: { id: true } }, studentProfile: { select: { id: true, tenantId: true, status: true, preferredDays: true } } } });
  if (!user) return null;
  const student = user.studentProfile;

  let workouts: { name: string; suggestedDays: string[] }[] = [];
  let tenantId: string;
  if (user.role === "ALUNO") {
    if (!student || student.status !== "ATIVO") return null;
    tenantId = student.tenantId;
    const assignment = await client.planAssignment.findFirst({
      where: { tenantId, studentId: student.id, active: true },
      select: { trainingPlan: { select: { workouts: { select: { name: true, suggestedDays: true }, orderBy: { position: "asc" } } } } },
    });
    if (!assignment) return null;
    workouts = assignment.trainingPlan.workouts;
  } else if (user.role === "INDIVIDUAL" && user.ownedTenant) {
    tenantId = user.ownedTenant.id;
    workouts = await client.workout.findMany({ where: { tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } }, select: { name: true, suggestedDays: true }, orderBy: { position: "asc" } });
    if (workouts.length === 0) return null;
  } else {
    return null;
  }
  if (!student) return null;

  const days = student.preferredDays.length > 0 ? student.preferredDays : [...new Set(workouts.flatMap((workout) => workout.suggestedDays))];
  if (!days.includes(weekday)) return null;
  const workout = workouts.find((entry) => entry.suggestedDays.includes(weekday)) ?? null;
  return { studentId: student.id, tenantId, workoutName: workout?.name ?? null };
}

export async function runDueReminders(options: { now?: Date; client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}): Promise<{ sent: number }> {
  const client = options.client ?? prisma;
  const clock = localClock(options.now ?? new Date());
  const due = await client.notificationSettings.findMany({
    where: { reminderHour: clock.hour, OR: [{ lastReminderOn: null }, { lastReminderOn: { not: clock.dateKey } }], user: { pushSubscriptions: { some: {} } } },
    select: { userId: true },
    take: 500,
  });

  let sent = 0;
  for (const { userId } of due) {
    const today = await todayFor(userId, clock.weekday, client);
    if (!today) continue;
    const trained = await client.workoutSession.count({ where: { tenantId: today.tenantId, studentId: today.studentId, startedAt: { gte: clock.dayStart } } });
    if (trained > 0) continue;
    const claimed = await client.notificationSettings.updateMany({ where: { userId, OR: [{ lastReminderOn: null }, { lastReminderOn: { not: clock.dateKey } }] }, data: { lastReminderOn: clock.dateKey } });
    if (claimed.count === 0) continue;
    const delivered = await sendToUser(
      userId,
      { title: "Hora do treino", body: today.workoutName ? `Hoje: ${today.workoutName}. Bora?` : "Hoje é dia de treino. Bora?", url: "/painel", tag: "lembrete-treino" },
      { client, sender: options.sender, config: options.config }
    );
    if (delivered > 0) sent += 1;
  }
  return { sent };
}

export function weekdayName(key: string): string {
  return WEEKDAYS.find((day) => day.key === key)?.name ?? key;
}
