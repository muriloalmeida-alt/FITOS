import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { refreshOverdueCharges } from "@/modules/student-finance/charges";
import { deriveAccessStatus } from "./invitations";

/// BK-05 (FIT-143): feed "Acontecendo agora" do Início do personal. Cada
/// item é **uma** ação a um toque, nunca uma central de alertas. Um item
/// por aluno, pelo sinal de maior prioridade; lista curta (padrão 8).
/// Só entra o que pede uma ação do personal: treino concluído não entra.

export type PersonalFeedKind =
  | "cobranca_atrasada"
  | "convite_expirado"
  | "convite_aceito"
  | "sem_programa"
  | "programa_terminando"
  | "avaliacao_pendente";

export interface PersonalFeedItem {
  kind: PersonalFeedKind;
  studentId: string;
  studentName: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: "error" | "warn" | "ok" | "muted";
  /// Data do evento que ordena itens do mesmo tipo (mais recente primeiro).
  at: Date | null;
  /// Valor em centavos (só cobrança atrasada).
  amountCents?: number;
  /// Cobranças atrasadas, para "Recebi" direto na fila (EPIC-29).
  chargeIds?: string[];
}

export interface PersonalFeed {
  items: PersonalFeedItem[];
  total: number;
}

const DAY = 86_400_000;
const INVITE_ACCEPTED_WINDOW_DAYS = 7;
const PROGRAM_ENDING_WINDOW_DAYS = 7;
const ASSESSMENT_THRESHOLD_DAYS = 60;

const PRIORITY: Record<PersonalFeedKind, number> = {
  cobranca_atrasada: 0,
  convite_expirado: 1,
  convite_aceito: 2,
  sem_programa: 3,
  programa_terminando: 4,
  avaliacao_pendente: 5,
};

function centsBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

export async function getPersonalFeed(input: { tenantId: string; now?: Date; limit?: number }, client: PrismaClient = prisma): Promise<PersonalFeed> {
  const now = input.now ?? new Date();
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);

  const students = await client.student.findMany({
    where: { tenantId: input.tenantId, status: "ATIVO" },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    include: {
      invitations: { orderBy: { createdAt: "desc" }, take: 1 },
      planAssignments: { where: { active: true }, take: 1, include: { trainingPlan: { select: { name: true, durationWeeks: true } } } },
      charges: { where: { status: "ATRASADO" }, select: { id: true, amountCents: true } },
      assessments: { where: { deletedAt: null }, orderBy: { recordedAt: "desc" }, take: 1, select: { recordedAt: true } },
    },
  });

  const items: PersonalFeedItem[] = [];
  for (const student of students) {
    const base = { studentId: student.id, studentName: student.displayName };
    const profile = `/painel/alunos/${student.id}`;
    const invitation = student.invitations[0] ?? null;
    const access = deriveAccessStatus(student, invitation);
    const assignment = student.planAssignments[0] ?? null;
    const overdueCents = student.charges.reduce((sum, charge) => sum + charge.amountCents, 0);

    if (overdueCents > 0) {
      const count = student.charges.length;
      items.push({
        ...base,
        kind: "cobranca_atrasada",
        description: `${count === 1 ? "Cobrança atrasada" : `${count} cobranças atrasadas`} · ${centsBRL(overdueCents)}`,
        actionLabel: "Registrar pagamento",
        href: `${profile}?acao=receber`,
        tone: "error",
        at: null,
        amountCents: overdueCents,
        chargeIds: student.charges.map((charge) => charge.id),
      });
      continue;
    }

    if (access === "CONVITE_EXPIRADO" || access === "CONVITE_CANCELADO") {
      items.push({
        ...base,
        kind: "convite_expirado",
        description: access === "CONVITE_EXPIRADO" ? "O convite expirou sem ser aceito" : "O convite foi cancelado",
        actionLabel: "Gerar novo convite",
        href: `${profile}?acao=convite`,
        tone: "warn",
        at: invitation?.expiresAt ?? null,
      });
      continue;
    }

    if (!assignment) {
      const acceptedAt = invitation?.acceptedAt ?? null;
      if (acceptedAt && daysBetween(acceptedAt, now) < INVITE_ACCEPTED_WINDOW_DAYS) {
        items.push({ ...base, kind: "convite_aceito", description: "Aceitou o convite. Ainda sem programa", actionLabel: "Dar programa", href: `/painel/treinos?aluno=${student.id}`, tone: "ok", at: acceptedAt });
      } else {
        items.push({ ...base, kind: "sem_programa", description: "Sem programa de treino", actionLabel: "Dar programa", href: `/painel/treinos?aluno=${student.id}`, tone: "warn", at: student.createdAt });
      }
      continue;
    }

    const weeks = assignment.trainingPlan.durationWeeks;
    if (weeks) {
      const endsAt = new Date(assignment.assignedAt.getTime() + weeks * 7 * DAY);
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY);
      if (daysLeft <= PROGRAM_ENDING_WINDOW_DAYS) {
        items.push({
          ...base,
          kind: "programa_terminando",
          description: daysLeft <= 0 ? `${assignment.trainingPlan.name} terminou` : `${assignment.trainingPlan.name} termina em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`,
          actionLabel: "Repetir o programa",
          href: `/painel/treinos?aluno=${student.id}`,
          tone: "warn",
          at: endsAt,
        });
        continue;
      }
    }

    const lastAssessment = student.assessments[0]?.recordedAt ?? null;
    const days = lastAssessment ? daysBetween(lastAssessment, now) : null;
    if (days === null || days >= ASSESSMENT_THRESHOLD_DAYS) {
      items.push({
        ...base,
        kind: "avaliacao_pendente",
        description: days === null ? "Nenhuma avaliação registrada" : `Última avaliação há ${days} dias`,
        actionLabel: "Registrar agora",
        href: `${profile}/avaliacao`,
        tone: "muted",
        at: lastAssessment,
      });
    }
  }

  items.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0) || a.studentName.localeCompare(b.studentName, "pt-BR"));
  return { items: items.slice(0, input.limit ?? 8), total: items.length };
}
