import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { WEEKDAYS, formatDays } from "@/shared/lib/weekdays";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";

/// "Meus dias" (EPIC-31): os dias em que a pessoa combinou treinar. Usados
/// pelo lembrete de treino. Quando um aluno muda os dias, o personal
/// recebe um aviso no celular.

export class PreferredDaysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferredDaysError";
  }
}

export function normalizeDays(days: unknown): string[] {
  if (!Array.isArray(days) || days.some((day) => typeof day !== "string" || !WEEKDAYS.some((weekday) => weekday.key === day))) {
    throw new PreferredDaysError("Dias inválidos.");
  }
  return WEEKDAYS.map((weekday) => weekday.key).filter((key) => days.includes(key));
}

export async function setPreferredDays(
  input: { tenantId: string; studentId: string; days: unknown; notifyPersonal: boolean },
  options: { client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}
): Promise<{ days: string[]; notified: boolean }> {
  const client = options.client ?? prisma;
  const days = normalizeDays(input.days);
  const student = await client.student.findFirst({ where: { id: input.studentId, tenantId: input.tenantId }, select: { id: true, displayName: true, preferredDays: true, tenant: { select: { ownerId: true } } } });
  if (!student) throw new PreferredDaysError("Aluno não encontrado.");
  const changed = student.preferredDays.join(",") !== days.join(",");
  if (!changed) return { days, notified: false };
  await client.student.update({ where: { id: student.id }, data: { preferredDays: days } });
  if (!input.notifyPersonal) return { days, notified: false };
  const first = student.displayName.trim().split(/\s+/)[0] ?? student.displayName;
  const delivered = await sendToUser(
    student.tenant.ownerId,
    {
      title: `${first} mudou os dias de treino`,
      body: days.length > 0 ? `Agora: ${formatDays(days).toLowerCase()}.` : "Voltou para os dias do programa.",
      url: `/painel/alunos/${student.id}`,
      tag: `dias-${student.id}`,
    },
    { client, sender: options.sender, config: options.config }
  );
  return { days, notified: delivered > 0 };
}
