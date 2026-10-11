import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { refreshOverdueCharges } from "@/modules/student-finance/charges";

/// Painel de risco (EPIC-43): quem pode estar indo embora, com o porquê
/// e a ação ao lado. Sinais simples e explicáveis — nada de "nota mágica":
/// parou de treinar, treinando bem menos que antes, mensalidade atrasada,
/// programa no fim e mensagem sem resposta.

export type RiskSignalKind = "sem_treinar" | "treino_caiu" | "cobranca_atrasada" | "programa_acabando" | "mensagem_sem_resposta";

export interface RiskSignal {
  kind: RiskSignalKind;
  label: string;
  weight: number;
}

export interface RiskRow {
  studentId: string;
  name: string;
  image: string | null;
  level: "alto" | "medio";
  score: number;
  signals: RiskSignal[];
  action: { label: string; href: string };
}

const DAY = 86_400_000;
const WINDOW_DAYS = 14;
const BASELINE_WINDOWS = 4;
const INACTIVE_DAYS = 10;
const PROGRAM_END_WINDOW_DAYS = 7;
const UNANSWERED_HOURS = 24;

const days = (ms: number) => Math.floor(ms / DAY);

export function sessionsDropSignal(recent: number, baselinePerWindow: number): RiskSignal | null {
  if (baselinePerWindow < 2 || recent > baselinePerWindow * 0.5) return null;
  const before = Math.round(baselinePerWindow);
  return { kind: "treino_caiu", label: `Treinou ${recent} ${recent === 1 ? "vez" : "vezes"} em 2 semanas (antes, ~${before})`, weight: 2 };
}

export async function getRiskPanel(input: { tenantId: string; now?: Date }, client: PrismaClient = prisma): Promise<RiskRow[]> {
  const now = input.now ?? new Date();
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);
  const since = new Date(now.getTime() - WINDOW_DAYS * (BASELINE_WINDOWS + 1) * DAY);
  const recentFrom = now.getTime() - WINDOW_DAYS * DAY;

  const students = await client.student.findMany({
    where: { tenantId: input.tenantId, status: "ATIVO" },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      user: { select: { image: true } },
      workoutSessions: { where: { status: "CONCLUIDA", OR: [{ endedAt: { gte: since } }, { startedAt: { gte: since } }] }, select: { startedAt: true, endedAt: true } },
      planAssignments: { where: { active: true }, take: 1, orderBy: { assignedAt: "desc" }, select: { assignedAt: true, trainingPlan: { select: { durationWeeks: true } } } },
      charges: { where: { status: "ATRASADO" }, select: { amountCents: true } },
      chatTopics: { where: { resolvedAt: null, lastStudentMessageAt: { not: null } }, select: { lastStudentMessageAt: true, lastPersonalMessageAt: true } },
    },
  });
  const lastSessions = await client.workoutSession.groupBy({
    by: ["studentId"],
    where: { tenantId: input.tenantId, status: "CONCLUIDA" },
    _max: { startedAt: true },
  });
  const lastByStudent = new Map(lastSessions.map((row) => [row.studentId, row._max.startedAt]));

  const rows: RiskRow[] = [];
  for (const student of students) {
    const signals: RiskSignal[] = [];
    const assignment = student.planAssignments[0] ?? null;
    const last = lastByStudent.get(student.id) ?? null;

    // Parou de treinar: só conta quem tem programa há tempo suficiente.
    if (assignment) {
      const reference = last ?? assignment.assignedAt;
      const idle = days(now.getTime() - reference.getTime());
      if (idle >= INACTIVE_DAYS) {
        signals.push({ kind: "sem_treinar", label: last ? `Sem treinar há ${idle} dias` : `Não treinou desde que recebeu o programa (${idle} dias)`, weight: idle >= 21 ? 4 : 3 });
      }
    }

    // Treinando bem menos que antes (só se ainda treina; senão, o de cima).
    if (!signals.some((signal) => signal.kind === "sem_treinar")) {
      const times = student.workoutSessions.map((session) => (session.endedAt ?? session.startedAt).getTime());
      const recent = times.filter((time) => time >= recentFrom).length;
      const baselineFrom = Math.max(since.getTime(), student.createdAt.getTime());
      const baselineWindows = (recentFrom - baselineFrom) / (WINDOW_DAYS * DAY);
      if (baselineWindows >= 1) {
        const drop = sessionsDropSignal(recent, times.filter((time) => time < recentFrom).length / baselineWindows);
        if (drop) signals.push(drop);
      }
    }

    if (student.charges.length > 0) {
      const total = student.charges.reduce((sum, charge) => sum + charge.amountCents, 0);
      signals.push({ kind: "cobranca_atrasada", label: `${student.charges.length === 1 ? "Mensalidade atrasada" : `${student.charges.length} mensalidades atrasadas`} (${(total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`, weight: 3 });
    }

    const weeks = assignment?.trainingPlan.durationWeeks;
    if (assignment && weeks) {
      const left = days(assignment.assignedAt.getTime() + weeks * 7 * DAY - now.getTime());
      if (left <= PROGRAM_END_WINDOW_DAYS) signals.push({ kind: "programa_acabando", label: left < 0 ? `Programa terminou há ${-left} ${-left === 1 ? "dia" : "dias"}` : left === 0 ? "Programa termina hoje" : `Programa termina em ${left} ${left === 1 ? "dia" : "dias"}`, weight: left < 0 ? 2 : 1 });
    }

    const waiting = student.chatTopics
      .filter((topic) => topic.lastStudentMessageAt && (!topic.lastPersonalMessageAt || topic.lastPersonalMessageAt < topic.lastStudentMessageAt))
      .map((topic) => now.getTime() - topic.lastStudentMessageAt!.getTime())
      .filter((ms) => ms >= UNANSWERED_HOURS * 3_600_000);
    if (waiting.length > 0) {
      const hours = Math.floor(Math.max(...waiting) / 3_600_000);
      signals.push({ kind: "mensagem_sem_resposta", label: hours >= 48 ? `Mensagem sem resposta há ${Math.floor(hours / 24)} dias` : `Mensagem sem resposta há ${hours} h`, weight: 2 });
    }

    const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
    if (score < 2) continue;
    signals.sort((a, b) => b.weight - a.weight);
    rows.push({
      studentId: student.id,
      name: student.displayName,
      image: student.user?.image ?? null,
      level: score >= 4 ? "alto" : "medio",
      score,
      signals,
      action: primaryAction(student.id, signals[0]!.kind),
    });
  }
  return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"));
}

function primaryAction(studentId: string, kind: RiskSignalKind): { label: string; href: string } {
  switch (kind) {
    case "cobranca_atrasada":
      return { label: "Cobrança", href: `/painel/alunos/${studentId}` };
    case "programa_acabando":
      return { label: "Programa", href: `/painel/alunos/${studentId}` };
    case "mensagem_sem_resposta":
      return { label: "Responder", href: `/painel/mensagens?aluno=${studentId}` };
    default:
      return { label: "Mensagem", href: `/painel/mensagens?aluno=${studentId}&nova=1` };
  }
}

export async function riskCount(tenantId: string, client: PrismaClient = prisma): Promise<{ alto: number; total: number }> {
  const rows = await getRiskPanel({ tenantId }, client);
  return { alto: rows.filter((row) => row.level === "alto").length, total: rows.length };
}
