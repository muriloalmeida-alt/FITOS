import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getTodayScheduleForStudent } from "@/modules/workouts/workouts";
import { PersonalHome } from "./PersonalHome";
import { AlunoHome } from "./AlunoHome";
import { AlunoSemVinculo } from "./AlunoSemVinculo";
import { AlunoInativo } from "./AlunoInativo";

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
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    return <PersonalHome name={session.user.name} email={session.user.email} tenantName={tenant?.name ?? null} />;
  }

  if (!ctx.studentId) {
    // FIT-016: "sem vínculo" (Student nunca existiu) e "inativo" (Student
    // existe, mas foi pausado pelo personal — FIT-014) são estados reais
    // distintos — cada um com sua própria mensagem, nunca confundidos.
    const student = await prisma.student.findUnique({ where: { userId: ctx.userId } });
    return student?.status === "INATIVO" ? <AlunoInativo /> : <AlunoSemVinculo />;
  }

  const [student, schedule] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: ctx.studentId },
      include: { tenant: { include: { owner: true } } },
    }),
    getTodayScheduleForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId }),
  ]);
  return (
    <AlunoHome
      displayName={student.displayName}
      tenantName={student.tenant.name}
      personalName={student.tenant.owner.name}
      schedule={schedule}
    />
  );
}
