import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { MonthlyReportView } from "../../../_report/MonthlyReportView";
import { reportProps } from "../../../_report/reportProps";

export const metadata: Metadata = { title: `Relatório do mês — ${appName}` };

/// Relatório do mês de um aluno, para o personal (EPIC-45).
export default async function RelatorioAlunoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ mes?: string }> }) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: (await params).id });
  if (!student) notFound();
  const sp = (await searchParams) ?? {};
  const props = await reportProps({ tenantId: ctx.tenantId, studentId: student.id, month: sp.mes, base: `/painel/alunos/${student.id}/relatorio` });
  return (
    <AppShell eyebrow="Relatório do mês" title={student.displayName} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <MonthlyReportView {...props} name={student.displayName} />
    </AppShell>
  );
}
