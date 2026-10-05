import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { formatCentsBRL } from "@/shared/lib/money";
import { sendToUser, type PushConfig, type PushPayload, type Sender } from "./push";
import { localClock } from "./reminders";

/// Avisos que o personal escolhe receber (Configurações, EPIC-36): aluno
/// mudou os dias de treino (enviado na hora, `preferredDays.ts`), aluno sem
/// treinar há N dias, mensalidade atrasada e programa que terminou. Os
/// três últimos rodam no agendador a partir das 9h de Brasília, um aviso
/// por tipo (agrupando os alunos) e cada caso uma vez só
/// (`personal_alerts`).

export const INACTIVE_DAY_OPTIONS = [3, 5, 7, 14] as const;
const SEND_FROM_HOUR = 9;
const OVERDUE_LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;

export interface AlertSettings {
  daysChanged: boolean;
  /// `null` = desligado.
  inactiveDays: number | null;
  overdue: boolean;
  programEnd: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { daysChanged: true, inactiveDays: 7, overdue: true, programEnd: true };

export class AlertSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertSettingsError";
  }
}

type Row = { alertDaysChanged: boolean; alertInactiveDays: number | null; alertOverdue: boolean; alertProgramEnd: boolean } | null;

function fromRow(row: Row): AlertSettings {
  return row ? { daysChanged: row.alertDaysChanged, inactiveDays: row.alertInactiveDays, overdue: row.alertOverdue, programEnd: row.alertProgramEnd } : { ...DEFAULT_ALERT_SETTINGS };
}

export async function getAlertSettings(userId: string, client: PrismaClient = prisma): Promise<AlertSettings> {
  return fromRow(await client.notificationSettings.findUnique({ where: { userId } }));
}

export async function setAlertSettings(userId: string, patch: Partial<AlertSettings>, client: PrismaClient = prisma): Promise<AlertSettings> {
  const data: { alertDaysChanged?: boolean; alertOverdue?: boolean; alertProgramEnd?: boolean; alertInactiveDays?: number | null } = {};
  for (const key of ["daysChanged", "overdue", "programEnd"] as const) {
    if (patch[key] === undefined) continue;
    if (typeof patch[key] !== "boolean") throw new AlertSettingsError("Valor inválido.");
    data[key === "daysChanged" ? "alertDaysChanged" : key === "overdue" ? "alertOverdue" : "alertProgramEnd"] = patch[key];
  }
  if (patch.inactiveDays !== undefined) {
    if (patch.inactiveDays !== null && !(INACTIVE_DAY_OPTIONS as readonly number[]).includes(patch.inactiveDays)) {
      throw new AlertSettingsError("Escolha 3, 5, 7 ou 14 dias.");
    }
    data.alertInactiveDays = patch.inactiveDays;
  }
  const row = await client.notificationSettings.upsert({
    where: { userId },
    create: { ...data, userId },
    update: data,
  });
  return fromRow(row);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function names(list: string[]): string {
  const firsts = list.map(firstName);
  if (firsts.length <= 3) return firsts.length === 1 ? firsts[0]! : `${firsts.slice(0, -1).join(", ")} e ${firsts.at(-1)}`;
  return `${firsts.slice(0, 2).join(", ")} e mais ${firsts.length - 2}`;
}

function shortDate(date: Date): string {
  const [, month, day] = localClock(date).dateKey.split("-");
  return `${day}/${month}`;
}

type Hit = { refKey: string; studentId: string; name: string; detail?: string };

export function inactiveMessage(days: number, hits: Hit[]): PushPayload {
  return hits.length === 1
    ? { title: `${firstName(hits[0]!.name)} está há ${days} dias sem treinar`, body: "Uma mensagem agora costuma trazer o aluno de volta.", url: `/painel/alunos/${hits[0]!.studentId}`, tag: "aviso-inativo" }
    : { title: `${hits.length} alunos sem treinar há ${days} dias`, body: `${names(hits.map((hit) => hit.name))}.`, url: "/painel/alunos", tag: "aviso-inativo" };
}

export function overdueMessage(hits: Hit[]): PushPayload {
  return hits.length === 1
    ? { title: `Mensalidade de ${firstName(hits[0]!.name)} atrasou`, body: `${hits[0]!.detail}.`, url: "/painel/financeiro", tag: "aviso-atraso" }
    : { title: `${hits.length} mensalidades atrasaram`, body: `${names(hits.map((hit) => hit.name))}.`, url: "/painel/financeiro", tag: "aviso-atraso" };
}

export function programEndMessage(hits: Hit[]): PushPayload {
  return hits.length === 1
    ? { title: `O programa de ${firstName(hits[0]!.name)} terminou`, body: `${hits[0]!.detail} chegou ao fim. Hora de montar o próximo.`, url: `/painel/alunos/${hits[0]!.studentId}`, tag: "aviso-programa" }
    : { title: `${hits.length} programas terminaram`, body: `${names(hits.map((hit) => hit.name))}. Hora de montar os próximos.`, url: "/painel/alunos", tag: "aviso-programa" };
}

/// Registra os casos novos (os já avisados ficam de fora).
async function fresh(client: PrismaClient, userId: string, kind: string, hits: Hit[]): Promise<Hit[]> {
  const out: Hit[] = [];
  for (const hit of hits) {
    try {
      await client.personalAlert.create({ data: { userId, kind, refKey: hit.refKey } });
      out.push(hit);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return out;
}

export async function runPersonalAlerts(options: { now?: Date; client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}): Promise<{ sent: number }> {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();
  const clock = localClock(now);
  if (clock.hour < SEND_FROM_HOUR) return { sent: 0 };

  const owners = await client.user.findMany({
    where: { role: "PERSONAL", pushSubscriptions: { some: {} }, ownedTenant: { isNot: null } },
    select: { id: true, ownedTenant: { select: { id: true } }, notificationSettings: true },
    take: 2000,
  });

  let sent = 0;
  const send = async (userId: string, payload: PushPayload) => {
    if ((await sendToUser(userId, payload, { client, sender: options.sender, config: options.config })) > 0) sent += 1;
  };

  for (const owner of owners) {
    const tenantId = owner.ownedTenant!.id;
    const settings = fromRow(owner.notificationSettings);

    if (settings.inactiveDays) {
      const days = settings.inactiveDays;
      const students = await client.student.findMany({
        where: { tenantId, status: "ATIVO", userId: { not: null }, planAssignments: { some: { active: true } } },
        select: {
          id: true,
          displayName: true,
          planAssignments: { where: { active: true }, select: { assignedAt: true }, take: 1 },
          workoutSessions: { where: { status: "CONCLUIDA" }, orderBy: { startedAt: "desc" }, select: { startedAt: true }, take: 1 },
        },
      });
      const hits = students.flatMap((student) => {
        const since = [student.workoutSessions[0]?.startedAt, student.planAssignments[0]?.assignedAt].filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0];
        if (!since || now.getTime() - since.getTime() < days * DAY_MS) return [];
        return [{ refKey: `${student.id}:${since.toISOString()}`, studentId: student.id, name: student.displayName }];
      });
      const news = await fresh(client, owner.id, "INATIVO", hits);
      if (news.length > 0) await send(owner.id, inactiveMessage(days, news));
    }

    if (settings.overdue) {
      const charges = await client.studentCharge.findMany({
        where: { tenantId, status: { in: ["PENDENTE", "ATRASADO"] }, payment: null, dueDate: { lt: clock.dayStart, gte: new Date(clock.dayStart.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS) }, student: { status: "ATIVO" } },
        select: { id: true, amountCents: true, dueDate: true, student: { select: { id: true, displayName: true } } },
        orderBy: { dueDate: "asc" },
      });
      const hits = charges.map((charge) => ({ refKey: charge.id, studentId: charge.student.id, name: charge.student.displayName, detail: `${formatCentsBRL(charge.amountCents)} venceu em ${shortDate(charge.dueDate)}` }));
      const news = await fresh(client, owner.id, "ATRASO", hits);
      if (news.length > 0) await send(owner.id, overdueMessage(news));
    }

    if (settings.programEnd) {
      const assignments = await client.planAssignment.findMany({
        where: { tenantId, active: true, student: { status: "ATIVO" }, trainingPlan: { durationWeeks: { not: null } } },
        select: { id: true, assignedAt: true, student: { select: { id: true, displayName: true } }, trainingPlan: { select: { name: true, durationWeeks: true } } },
      });
      const hits = assignments.flatMap((assignment) => {
        const weeks = assignment.trainingPlan.durationWeeks!;
        if (now.getTime() - assignment.assignedAt.getTime() < weeks * 7 * DAY_MS) return [];
        return [{ refKey: assignment.id, studentId: assignment.student.id, name: assignment.student.displayName, detail: assignment.trainingPlan.name }];
      });
      const news = await fresh(client, owner.id, "FIM_PROGRAMA", hits);
      if (news.length > 0) await send(owner.id, programEndMessage(news));
    }
  }
  return { sent };
}
