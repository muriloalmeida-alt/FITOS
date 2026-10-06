import type { Metadata } from "next";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { LogoutButton } from "../LogoutButton";
import { selfPage } from "../_self";
import { MonthlyReportView } from "../_report/MonthlyReportView";
import { reportProps } from "../_report/reportProps";

export const metadata: Metadata = { title: `Relatório do mês — ${appName}` };

/// Relatório do mês do aluno e do Livre (EPIC-45).
export default async function RelatorioPage({ searchParams }: { searchParams?: Promise<{ mes?: string }> } = {}) {
  const ctx = await selfPage();
  const sp = (await searchParams) ?? {};
  const [props, user] = await Promise.all([
    reportProps({ tenantId: ctx.tenantId, studentId: ctx.studentId, month: sp.mes, base: "/painel/relatorio" }),
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true } }),
  ]);
  return (
    <AppShell eyebrow="Relatório do mês" title="Seu mês" navItems={ctx.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <MonthlyReportView {...props} name={user.name} />
    </AppShell>
  );
}
