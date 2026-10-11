import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell, SegmentedTabs } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { getAchievements } from "@/modules/gamification/achievements";
import { classMemberWorkouts, getClassRanking, getClassRankingState, isParticipant, type RankingViewer } from "@/modules/gamification/classRanking";
import { listReviewQueue } from "@/modules/gamification/scoreContests";
import { reviewCasesView, workoutsView } from "./contestData";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { AchievementsView } from "./AchievementsView";
import { FriendGroupsPanel } from "./FriendGroupsPanel";
import { listMyFriendGroups } from "@/modules/gamification/friendGroups";
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
        <ClassRankingPanel role="PERSONAL" enabled={state.enabled} joined={false} period={period} rows={rows} basePath="/painel/desafios?aba=turma" reviewCases={reviewCasesView(await listReviewQueue({ userId: ctx.userId }, { context: "TURMA" }))} />
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
  const tab = sp.aba === "amigos" ? "amigos" : self.role === "ALUNO" && sp.aba === "turma" ? "turma" : "conquistas";
  let content;
  if (tab === "turma") {
    const scope = { tenantId: self.tenantId, studentId: self.studentId };
    const [state, joined] = await Promise.all([getClassRankingState(self.tenantId), isParticipant(scope)]);
    const rows = state.enabled && joined ? await rankingRows({ role: "ALUNO", ...scope }, period) : null;
    const workouts = rows ? workoutsView(await classMemberWorkouts(scope, period === "mes" ? "MES" : "SEMANA")) : {};
    content = <ClassRankingPanel role="ALUNO" enabled={state.enabled} joined={joined} period={period} rows={rows} basePath="/painel/desafios?aba=turma" workouts={workouts} />;
  } else if (tab === "amigos") {
    const groups = await listMyFriendGroups(self);
    content = (
      <FriendGroupsPanel
        nowIso={new Date().toISOString()}
        groups={groups.map((group) => ({ ...group, season: group.season ? { ...group.season, startsAt: group.season.startsAt.toISOString(), endsAt: group.season.endsAt.toISOString() } : null }))}
      />
    );
  } else {
    content = <AchievementsView achievements={await getAchievements(self)} />;
  }
  const titles = { conquistas: "Suas conquistas", turma: "Ranking da turma", amigos: "Amigos" } as const;
  return (
    <AppShell eyebrow="Desafios" title={titles[tab]} navItems={navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <SegmentedTabs
        label="Desafios"
        value={tab}
        items={[
          { key: "conquistas", label: "Conquistas", href: "/painel/desafios" },
          ...(self.role === "ALUNO" ? [{ key: "turma", label: "Turma", href: "/painel/desafios?aba=turma" }] : []),
          { key: "amigos", label: "Amigos", href: "/painel/desafios?aba=amigos" },
        ]}
      />
      {content}
    </AppShell>
  );
}
