import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getTodayScheduleForStudent, listWorkoutsForTenant } from "@/modules/workouts/workouts";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { listStudents } from "@/modules/students/students";
import { getFinancialSummary } from "@/modules/student-finance/charges";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { PersonalHome } from "./PersonalHome";
import { AlunoHome } from "./AlunoHome";
import { AlunoSemVinculo } from "./AlunoSemVinculo";
import { AlunoInativo } from "./AlunoInativo";
import { IndividualHome } from "./IndividualHome";

export const metadata: Metadata = {
  title: `Painel — ${appName}`,
};

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
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [tenant, activeStudents, activeWorkouts, financialSummary] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId } }),
      listStudents({ tenantId: ctx.tenantId, status: "ATIVO", pageSize: 1 }),
      listWorkoutsForTenant({ tenantId: ctx.tenantId }),
      getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth: currentMonth }),
    ]);
    return (
      <PersonalHome
        name={session.user.name}
        email={session.user.email}
        tenantName={tenant?.name ?? null}
        activeStudentsCount={activeStudents.total}
        activeWorkoutsCount={activeWorkouts.length}
        atrasadoCents={financialSummary.atrasadoCents}
      />
    );
  }

  if (ctx.role === "INDIVIDUAL") {
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding");
    }
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    return (
      <IndividualHome
        name={session.user.name}
        tenantName={tenant.name}
        objective={profile.objective}
        experienceLevel={profile.experienceLevel}
        weeklyAvailability={profile.weeklyAvailability}
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

  const [student, schedule, inProgressSession] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: ctx.studentId },
      include: { tenant: { include: { owner: true } } },
    }),
    getTodayScheduleForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
    getInProgressSessionForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
  ]);
  return (
    <AlunoHome
      displayName={student.displayName}
      tenantName={student.tenant.name}
      personalName={student.tenant.owner.name}
      schedule={schedule}
      hasInProgressSession={inProgressSession !== null}
    />
  );
}
