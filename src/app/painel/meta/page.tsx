import type { Metadata } from "next";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { suggestGoals } from "@/modules/evolution/goalSuggestions";
import { listGoalsForStudent } from "@/modules/evolution/goals";
import { LogoutButton } from "../LogoutButton";
import { selfPage } from "../_self";
import { GoalPicker } from "./GoalPicker";

export const metadata: Metadata = { title: `Meta — ${appName}` };

/// Próxima meta (EPIC-30): três sugestões com valores tirados dos próprios
/// dados; escolher, ajustar e pronto.
export default async function MetaPage() {
  const ctx = await selfPage();
  const [suggestions, goals] = await Promise.all([suggestGoals({ tenantId: ctx.tenantId, studentId: ctx.studentId }), listGoalsForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId })]);
  const current = goals.find((goal) => goal.status === "EM_ANDAMENTO") ?? null;
  return (
    <AppShell eyebrow={current ? `Atual: ${current.description}` : "Progresso"} title="Sua próxima meta" navItems={ctx.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <GoalPicker suggestions={suggestions} doneHref={ctx.progressHref} todayIso={new Date().toISOString()} />
    </AppShell>
  );
}
