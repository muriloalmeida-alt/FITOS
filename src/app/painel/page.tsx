import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getTodayScheduleForStudent, getWeeklyRhythmForStudent, listWorkoutExercisesForWorkout, listWorkoutsForTenant } from "@/modules/workouts/workouts";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { listStudents } from "@/modules/students/students";
import { getFinancialSummary, listChargesForTenant } from "@/modules/student-finance/charges";
import { getLastAssessmentDatesForTenant } from "@/modules/evolution/assessments";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { getPersonalAttentionItems } from "./getPersonalAttentionItems";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { getPersonalOnboardingProfile } from "@/modules/personal-onboarding/onboarding";
import { PersonalHome } from "./PersonalHome";
import { AlunoHome } from "./AlunoHome";
import { AlunoSemVinculo } from "./AlunoSemVinculo";
import { AlunoInativo } from "./AlunoInativo";
import { IndividualHome } from "./IndividualHome";

export const metadata: Metadata = {
  title: `Painel — ${appName}`,
};

/// Saudação real por hora do request (FIT-137, tela-06) — sempre calculada
/// no servidor (nunca no cliente, que hidrataria com o fuso do navegador e
/// poderia divergir do HTML já enviado).
function greetingForHour(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/// Fuso do produto (usuários no Brasil). AjustesPainel (29/09/2026): data e
/// saudação do cabeçalho seguem o relógio de Brasília, nunca o fuso do
/// servidor (UTC em homologação), que trocaria "Bom dia" por "Boa tarde"
/// três horas antes.
const PRODUCT_TIME_ZONE = "America/Sao_Paulo";

function hourInProductTimeZone(date: Date): number {
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: PRODUCT_TIME_ZONE }).format(date);
  return Number.parseInt(hour, 10);
}

/// "Terça, 29 de setembro" — eyebrow de data do Início (AjustesPainel).
function dateLabelFor(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: PRODUCT_TIME_ZONE }).format(date).replace(/-feira$/, "");
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: PRODUCT_TIME_ZONE }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`;
}

/// Única rota autenticada (FIT-012): o shell exibido (personal ou aluno) é
/// decidido inteiramente no servidor, a partir do papel derivado da sessão
/// (`getAuthContext`, FIT-011) — não existem rotas separadas por papel
/// (`/painel/personal`, `/painel/aluno`), então não há URL para adulterar
/// e "trocar de shell": o mesmo `/painel` sempre resolve para o shell do
/// papel real do usuário autenticado.
export default async function PainelPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }

  if (ctx.role === "PERSONAL") {
    const personalProfile = await getPersonalOnboardingProfile(ctx.tenantId);
    if (!personalProfile) {
      redirect("/onboarding-personal");
    }
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [tenant, activeStudents, activeWorkouts, financialSummary, chargesThisMonth, lastAssessmentAtByStudentId] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      listStudents({ tenantId: ctx.tenantId, status: "ATIVO", pageSize: 100 }),
      listWorkoutsForTenant({ tenantId: ctx.tenantId }),
      getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth: currentMonth }),
      listChargesForTenant({ tenantId: ctx.tenantId, referenceMonth: currentMonth }),
      getLastAssessmentDatesForTenant({ tenantId: ctx.tenantId }),
    ]);

    // "Precisa de atenção" (FIT-120): só considera cobranças vencidas da
    // competência atual, mesma janela já usada por "Atrasado este mês" —
    // nunca varre o histórico financeiro inteiro do tenant.
    const overdueAmountCentsByStudentId = new Map<string, number>();
    for (const charge of chargesThisMonth) {
      if (charge.status === "ATRASADO") {
        overdueAmountCentsByStudentId.set(charge.student.id, (overdueAmountCentsByStudentId.get(charge.student.id) ?? 0) + charge.amountCents);
      }
    }
    const attentionItems = getPersonalAttentionItems({
      students: activeStudents.items.map((student) => ({ id: student.id, displayName: student.displayName })),
      overdueAmountCentsByStudentId,
      lastAssessmentAtByStudentId,
      now,
    });

    return (
      <PersonalHome
        name={session.user.name}
        email={session.user.email}
        tenantName={tenant?.name ?? null}
        greeting={greetingForHour(hourInProductTimeZone(now))}
        dateLabel={dateLabelFor(now)}
        activeStudentsCount={activeStudents.total}
        activeWorkoutsCount={activeWorkouts.length}
        atrasadoCents={financialSummary.atrasadoCents}
        attentionItems={attentionItems}
      />
    );
  }

  if (ctx.role === "INDIVIDUAL") {
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding");
    }
    const [tenant, workouts, selfStudent, subscription] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
      listWorkoutsForTenant({ tenantId: ctx.tenantId }),
      // Nunca cria o Student de auto-referência aqui (FIT-103): só
      // existe depois que o praticante começou algum treino — se ainda
      // não existe, é impossível haver uma sessão em andamento.
      prisma.student.findUnique({ where: { userId: ctx.userId } }),
      getSubscriptionForTenant(ctx.tenantId),
    ]);
    const [inProgressSession, weeklyRhythm] = await Promise.all([
      selfStudent ? getInProgressSessionForStudent({ tenantId: ctx.tenantId, studentId: selfStudent.id }) : null,
      selfStudent
        ? getWeeklyRhythmForStudent({ tenantId: ctx.tenantId, studentId: selfStudent.id })
        : Promise.resolve({ completedDays: 0, targetDays: null, dayFlags: [false, false, false, false, false, false, false] }),
    ]);
    // "Hoje para você" (tela-10, pacote visual 2026): sugere sempre o
    // primeiro treino real do próprio praticante (nunca um treino
    // inventado) — `listWorkoutsForTenant` já ordena por nome, então a
    // escolha é estável entre renders, não aleatória.
    const firstWorkout = workouts[0] ?? null;
    const suggestedWorkout = firstWorkout
      ? {
          id: firstWorkout.id,
          name: firstWorkout.name,
          exercisesCount: (await listWorkoutExercisesForWorkout({ tenantId: ctx.tenantId, workoutId: firstWorkout.id })).length,
        }
      : null;
    return (
      <IndividualHome
        name={session.user.name}
        greeting={greetingForHour(hourInProductTimeZone(new Date()))}
        dateLabel={dateLabelFor(new Date())}
        tenantName={tenant.name}
        objective={profile.objective}
        experienceLevel={profile.experienceLevel}
        weeklyAvailability={profile.weeklyAvailability}
        workoutsCount={workouts.length}
        inProgressWorkoutName={inProgressSession?.workout.name ?? null}
        suggestedWorkout={suggestedWorkout}
        weeklyRhythm={{ completedDays: weeklyRhythm.completedDays, dayFlags: weeklyRhythm.dayFlags }}
        subscription={
          subscription
            ? {
                planName: subscription.plan.name,
                priceCents: subscription.plan.priceCents,
                trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
              }
            : null
        }
      />
    );
  }

  if (!ctx.studentId) {
    // FIT-016: "sem vínculo" (Student nunca existiu) e "inativo" (Student
    // existe, mas foi pausado pelo personal — FIT-014) são estados reais
    // distintos — cada um com sua própria mensagem, nunca confundidos.
    const student = await prisma.student.findUnique({ where: { userId: ctx.userId } });
    return student?.status === "INATIVO" ? <AlunoInativo /> : <AlunoSemVinculo />;
  }

  const [student, schedule, inProgressSession, weeklyRhythm] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: ctx.studentId },
      include: { tenant: { include: { owner: true } } },
    }),
    getTodayScheduleForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
    getInProgressSessionForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
    getWeeklyRhythmForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
  ]);
  return (
    <AlunoHome
      displayName={student.displayName}
      tenantName={student.tenant.name}
      personalName={student.tenant.owner.name}
      schedule={schedule}
      hasInProgressSession={inProgressSession !== null}
      weeklyRhythm={{ completedDays: weeklyRhythm.completedDays, targetDays: weeklyRhythm.targetDays }}
      greeting={greetingForHour(hourInProductTimeZone(new Date()))}
      dateLabel={dateLabelFor(new Date())}
    />
  );
}
