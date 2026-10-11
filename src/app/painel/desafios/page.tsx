import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell, SegmentedTabs } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { getAchievements } from "@/modules/gamification/achievements";
import { getClassRanking, getClassRankingState, isParticipant, type RankingViewer } from "@/modules/gamification/classRanking";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { AchievementsView } from "./AchievementsView";
import { ClassRankingPanel, type RankingRowView } from "./ClassRankingPanel";

export const metadata: Metadata = {
  title: `Desafios — ${appName}`,
};

async function rankingRows(viewer: RankingViewer, period: "semana" | "mes"): Promise<RankingRowView[]> {
  const { rows } = await getClassRanking(viewer, period === "mes" ? "MES" : "SEMANA");
  return rows;
}

/// Desafios (feature 3). Aluno e Livre: Conquistas (meta, medalhas,
/// galeria); o aluno também tem a aba Turma (ranking do personal, com
/// adesão). Personal: liga o ranking da turma e acompanha. Desligado sem
/// `FEATURE_GAMIFICACAO=on`.
export default async function DesafiosPage({ searchParams }: { searchParams?: Promise<{ aba?: string; periodo?: string }> } = {}) {
  if (!featureEnabled("GAMIFICACAO")) notFound();
  const sp = (await searchParams) ?? {};
  const period = sp.periodo === "mes" ? "mes" : "semana";
  let ctx;
  try {
    ctx = await requireSession();
  } catch (error) {
    if (error instanceof AuthError) redirect("/entrar");
    throw error;
  }

  if (ctx.role === "PERSONAL") {
    const state = await getClassRankingState(ctx.tenantId);
    const rows = state.enabled ? await rankingRows({ role: "PERSONAL", tenantId: ctx.tenantId }, period) : null;
    return (
      <AppShell eyebrow="Desafios" title="Ranking da turma" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
        <ClassRankingPanel role="PERSONAL" enabled={state.enabled} joined={false} period={period} rows={rows} basePath="/painel/desafios?aba=turma" />
      </AppShell>
    );
  }

  let self;
  try {
    self = await requireSelfStudent();
  } catch (error) {
    if (error instanceof AuthError) redirect("/painel");
    throw error;
  }
  const navItems = self.role === "ALUNO" ? ALUNO_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS;
  const turma = self.role === "ALUNO" && sp.aba === "turma";
  let content;
  if (turma) {
    const scope = { tenantId: self.tenantId, studentId: self.studentId };
    const [state, joined] = await Promise.all([getClassRankingState(self.tenantId), isParticipant(scope)]);
    const rows = state.enabled && joined ? await rankingRows({ role: "ALUNO", ...scope }, period) : null;
    content = <ClassRankingPanel role="ALUNO" enabled={state.enabled} joined={joined} period={period} rows={rows} basePath="/painel/desafios?aba=turma" />;
  } else {
    content = <AchievementsView achievements={await getAchievements(self)} />;
  }
  return (
    <AppShell eyebrow="Desafios" title={turma ? "Ranking da turma" : "Suas conquistas"} navItems={navItems} activeKey="progresso" trailing={<LogoutButton />}>
      {self.role === "ALUNO" ? (
        <SegmentedTabs
          label="Desafios"
          value={turma ? "turma" : "conquistas"}
          items={[
            { key: "conquistas", label: "Conquistas", href: "/painel/desafios" },
            { key: "turma", label: "Turma", href: "/painel/desafios?aba=turma" },
          ]}
        />
      ) : null}
      {content}
    </AppShell>
  );
}
