import "server-only";
import type { PrismaClient, StudentStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { refreshOverdueCharges } from "@/modules/student-finance/charges";
import { deriveAccessStatus, type StudentAccessStatus } from "./invitations";

/// Carteira de alunos com o que a lista precisa para "cada linha termina
/// numa ação" (FIT-144, BK-06 e BK-07): status do convite, programa ativo,
/// aderência da semana, cobrança atrasada e se o aluno precisa do personal.

export type RosterFilter = "ativos" | "atencao" | "convites" | "inativos" | "todos";

export interface RosterRow {
  id: string;
  displayName: string;
  email: string;
  /// Foto de perfil do aluno (EPIC-35).
  image?: string | null;
  status: StudentStatus;
  accessStatus: StudentAccessStatus;
  activePlanName: string | null;
  /// Semana atual do programa (1…durationWeeks) quando há vigência.
  planWeek: number | null;
  planWeeks: number | null;
  weekDone: number;
  /// Dias previstos na semana pelo programa ativo (`null` sem dias definidos).
  weekTarget: number | null;
  hasOverdueCharge: boolean;
  lastSessionAt: Date | null;
  needsAttention: boolean;
  createdAt: Date;
}

export interface RosterResult {
  rows: RosterRow[];
  total: number;
  counts: Record<RosterFilter, number>;
}

const INVITE_PENDING: StudentAccessStatus[] = ["NAO_CONVIDADO", "CONVITE_PENDENTE", "CONVITE_EXPIRADO", "CONVITE_CANCELADO"];

function startOfWeek(reference: Date): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function matches(row: RosterRow, filter: RosterFilter): boolean {
  switch (filter) {
    case "ativos":
      return row.status === "ATIVO";
    case "atencao":
      return row.needsAttention;
    case "convites":
      return row.status === "ATIVO" && INVITE_PENDING.includes(row.accessStatus);
    case "inativos":
      return row.status !== "ATIVO";
    case "todos":
      return true;
  }
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function listStudentRoster(
  input: { tenantId: string; filter?: RosterFilter; search?: string; limit?: number; now?: Date },
  client: PrismaClient = prisma
): Promise<RosterResult> {
  const now = input.now ?? new Date();
  const weekStart = startOfWeek(now);
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);

  const students = await client.student.findMany({
    where: { tenantId: input.tenantId },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    include: {
      user: { select: { image: true } },
      invitations: { orderBy: { createdAt: "desc" }, take: 1 },
      planAssignments: {
        where: { active: true },
        take: 1,
        include: { trainingPlan: { select: { name: true, durationWeeks: true, workouts: { where: { status: "ATIVO" }, select: { suggestedDays: true } } } } },
      },
      charges: { where: { status: "ATRASADO" }, select: { id: true }, take: 1 },
      workoutSessions: { where: { status: "CONCLUIDA" }, orderBy: { startedAt: "desc" }, take: 8, select: { startedAt: true } },
    },
  });

  const rows: RosterRow[] = students.map((student) => {
    const assignment = student.planAssignments[0] ?? null;
    const plan = assignment?.trainingPlan ?? null;
    const days = new Set(plan?.workouts.flatMap((workout) => workout.suggestedDays) ?? []);
    const doneDays = new Set(student.workoutSessions.filter((session) => session.startedAt >= weekStart).map((session) => session.startedAt.toDateString()));
    const planWeeks = plan?.durationWeeks ?? null;
    const planWeek = assignment && planWeeks ? Math.min(planWeeks, Math.floor((now.getTime() - assignment.assignedAt.getTime()) / (7 * 86_400_000)) + 1) : null;
    const accessStatus = deriveAccessStatus(student, student.invitations[0] ?? null);
    const hasOverdueCharge = student.charges.length > 0;
    const row: RosterRow = {
      id: student.id,
      displayName: student.displayName,
      email: student.email,
      image: student.user?.image ?? null,
      status: student.status,
      accessStatus,
      activePlanName: plan?.name ?? null,
      planWeek,
      planWeeks,
      weekDone: doneDays.size,
      weekTarget: days.size > 0 ? days.size : null,
      hasOverdueCharge,
      lastSessionAt: student.workoutSessions[0]?.startedAt ?? null,
      needsAttention: false,
      createdAt: student.createdAt,
    };
    row.needsAttention =
      student.status === "ATIVO" && (!row.activePlanName || hasOverdueCharge || accessStatus === "CONVITE_EXPIRADO" || accessStatus === "CONVITE_CANCELADO");
    return row;
  });

  const counts = {
    ativos: rows.filter((row) => matches(row, "ativos")).length,
    atencao: rows.filter((row) => matches(row, "atencao")).length,
    convites: rows.filter((row) => matches(row, "convites")).length,
    inativos: rows.filter((row) => matches(row, "inativos")).length,
    todos: rows.length,
  };

  const search = input.search?.trim() ? normalize(input.search.trim()) : null;
  const filtered = rows.filter((row) => matches(row, input.filter ?? "ativos") && (!search || normalize(row.displayName).includes(search) || row.email.toLowerCase().includes(search)));
  return { rows: filtered.slice(0, input.limit ?? 30), total: filtered.length, counts };
}

/// BK-06: percentual dos treinos previstos na semana que foram feitos,
/// somando todos os alunos ativos com programa e dias definidos. `null`
/// quando ninguém tem treino previsto.
export function weeklyCompletionRate(rows: RosterRow[]): number | null {
  let target = 0;
  let done = 0;
  for (const row of rows) {
    if (row.status !== "ATIVO" || !row.weekTarget) continue;
    target += row.weekTarget;
    done += Math.min(row.weekDone, row.weekTarget);
  }
  return target === 0 ? null : Math.round((100 * done) / target);
}
