import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { periodOf } from "@/shared/lib/medals";

/// Painel do aluno (proposta 9): datas de realização dos treinos
/// concluídos (ao vivo, avulsos e retroativos, uma vez por sessão) na
/// semana e no mês atuais, e os dias de treino escolhidos ("meus dias").
/// Em andamento, rascunho e abandonado não contam.
export async function loadPanelData(scope: { tenantId: string; studentId: string }, now = new Date(), client: PrismaClient = prisma): Promise<{ performed: Date[]; preferredDays: string[] }> {
  const week = periodOf("SEMANA", now);
  const month = periodOf("MES", now);
  const from = week.start < month.start ? week.start : month.start;
  const to = week.end > month.end ? week.end : month.end;
  const [sessions, student] = await Promise.all([
    client.workoutSession.findMany({
      where: {
        tenantId: scope.tenantId,
        studentId: scope.studentId,
        status: "CONCLUIDA",
        OR: [{ performedAt: { gte: from, lt: to } }, { performedAt: null, startedAt: { gte: from, lt: to } }],
      },
      select: { performedAt: true, startedAt: true },
    }),
    client.student.findFirst({ where: { id: scope.studentId, tenantId: scope.tenantId }, select: { preferredDays: true } }),
  ]);
  return { performed: sessions.map((session) => session.performedAt ?? session.startedAt), preferredDays: student?.preferredDays ?? [] };
}
