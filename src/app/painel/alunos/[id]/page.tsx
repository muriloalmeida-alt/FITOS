import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { daysUntil, deriveAccessStatus, getLatestInvitationForStudent } from "@/modules/students/invitations";
import { getActivePlanAssignmentForStudent, getWeeklyRhythmForStudent, listTrainingPlanSummariesForTenant } from "@/modules/workouts/workouts";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { listSessionHistoryForStudent } from "@/modules/execution/history";
import { listActiveRecurrencesForTenant, listChargesForStudent } from "@/modules/student-finance/charges";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { StudentProfile } from "./StudentProfile";
import type { TimelineEntry } from "./profileTypes";
import { formatCentsBRL } from "@/shared/lib/money";

export const metadata: Metadata = {
  title: `Perfil do aluno — ${appName}`,
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function relative(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return `em ${dateFmt.format(date)}`;
}

type SheetParam = "assign" | "inactivate" | "end" | "pay" | "invite" | null;

const EFFORT_LABEL = ["", "leve", "ok", "puxado", "difícil", "no limite"];

interface AlunoPerfilPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ atribuir?: string; acao?: string }>;
}

/// Perfil do aluno (FIT-145). Busca sempre pelo tenant da sessão: aluno de
/// outro tenant é 404. `?atribuir=1` abre a escolha de programa (vem do
/// convite e do Início); `?acao=inativar|encerrar` vem das URLs antigas.
export default async function AlunoPerfilPage({ params, searchParams }: AlunoPerfilPageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: id });
  if (!student) {
    notFound();
  }
  const sp = (await searchParams) ?? {};
  if (sp.acao === "avaliar") redirect(`/painel/alunos/${student.id}/avaliacao`);
  const now = new Date();

  const [invitation, assignment, rhythm, programs, assessments, sessions, charges, recurrences] = await Promise.all([
    getLatestInvitationForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    getActivePlanAssignmentForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    getWeeklyRhythmForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listTrainingPlanSummariesForTenant({ tenantId: ctx.tenantId }),
    listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listSessionHistoryForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listChargesForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listActiveRecurrencesForTenant({ tenantId: ctx.tenantId }),
  ]);
  const accessStatus = deriveAccessStatus(student, invitation);
  const plan = assignment?.trainingPlan ?? null;
  const weeks = plan?.durationWeeks ?? null;
  const open = charges
    .filter((charge) => charge.status === "ATRASADO" || charge.status === "PENDENTE")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  const recurrence = recurrences.find((item) => item.studentId === student.id) ?? null;
  // Ações que chegam do feed do Início (FIT-143) abrem direto a sheet certa.
  const ACTION_SHEETS: Record<string, SheetParam> = { inativar: "inactivate", encerrar: "end", receber: open ? "pay" : null, convite: "invite" };
  const initialSheet: SheetParam = sp.atribuir === "1" ? "assign" : sp.acao && Object.hasOwn(ACTION_SHEETS, sp.acao) ? (ACTION_SHEETS[sp.acao] ?? null) : null;

  const fmt = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");
  const timeline: (TimelineEntry & { at: number })[] = [
    ...sessions.slice(0, 12).map((session) => ({
      id: session.id,
      kind: "treino" as const,
      title: session.status === "ABANDONADA" ? `${session.workoutName} · não terminou` : `Fez ${session.workoutName}`,
      meta: `${relative(session.startedAt, now)}${session.perceivedEffort ? ` · esforço ${EFFORT_LABEL[session.perceivedEffort]}` : ""}`,
      at: session.startedAt.getTime(),
    })),
    ...assessments.map((assessment) => ({
      id: assessment.id,
      kind: "avaliacao" as const,
      title: assessment.weightGrams !== null ? `Avaliação · ${fmt(assessment.weightGrams / 1000)} kg` : "Avaliação",
      meta: dateFmt.format(assessment.recordedAt),
      at: assessment.recordedAt.getTime(),
    })),
    ...charges.flatMap((charge) =>
      charge.payment
        ? [{ id: charge.id, kind: "pagamento" as const, title: `Pagou ${formatCentsBRL(charge.payment.amountCentsPaid)}`, meta: `${charge.description} · ${relative(charge.payment.paidAt, now)}`, at: charge.payment.paidAt.getTime() }]
        : []
    ),
  ].sort((a, b) => b.at - a.at);

  return (
    <AppShell eyebrow="Perfil do aluno" title={student.displayName} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <StudentProfile
        student={{
          id: student.id,
          displayName: student.displayName,
          email: student.email,
          status: student.status,
          hasAccount: student.userId !== null,
          sinceLabel: monthFmt.format(student.createdAt),
          endedLabel: student.endedAt ? dateFmt.format(student.endedAt) : null,
          endReason: student.endReason,
        }}
        access={{ status: accessStatus, daysLeft: accessStatus === "CONVITE_PENDENTE" && invitation ? daysUntil(invitation.expiresAt) : null }}
        program={
          assignment && plan
            ? {
                name: plan.name,
                weeks,
                week: weeks ? Math.min(weeks, Math.floor((now.getTime() - assignment.assignedAt.getTime()) / (7 * 86_400_000)) + 1) : null,
                days: [...new Set(plan.workouts.flatMap((workout) => workout.suggestedDays))],
                assignedLabel: relative(assignment.assignedAt, now),
              }
            : null
        }
        programs={programs.map((item) => ({ id: item.id, name: item.name, durationWeeks: item.durationWeeks, workoutCount: item.workoutCount, days: item.days }))}
        week={{ done: rhythm.completedDays, target: rhythm.targetDays }}
        sessions={sessions.slice(0, 5).map((session) => ({ id: session.id, workoutName: session.workoutName, dateLabel: relative(session.startedAt, now), status: session.status, perceivedEffort: session.perceivedEffort }))}
        assessments={assessments.map((assessment) => ({
          id: assessment.id,
          dateLabel: dateFmt.format(assessment.recordedAt),
          weightKg: assessment.weightGrams !== null ? assessment.weightGrams / 1000 : null,
          bodyFatPercent: assessment.bodyFatTenthPercent !== null ? assessment.bodyFatTenthPercent / 10 : null,
          notes: assessment.notes,
          measurements: assessment.measurements.map((m) => ({ type: m.type, valueCm: m.valueMillimeters / 10 })),
        }))}
        openCharge={open ? { id: open.id, description: open.description, amountCents: open.amountCents, status: open.status, dueLabel: shortFmt.format(open.dueDate), paidLabel: null } : null}
        recurrence={recurrence ? { id: recurrence.id, amountCents: recurrence.amountCents, day: recurrence.dueDayOfMonth } : null}
        timeline={timeline.map(({ at: _at, ...entry }) => entry)}
        initialSheet={initialSheet}
      />
    </AppShell>
  );
}
