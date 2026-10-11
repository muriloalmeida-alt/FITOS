import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { AuthError } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { getAchievements } from "@/modules/gamification/achievements";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { AchievementsView } from "./AchievementsView";

export const metadata: Metadata = {
  title: `Desafios — ${appName}`,
};

/// Desafios (feature 3): Conquistas pessoais (meta, medalhas e galeria)
/// do aluno e do FitOS Livre. Desligado sem `FEATURE_GAMIFICACAO=on`.
export default async function DesafiosPage() {
  if (!featureEnabled("GAMIFICACAO")) notFound();
  let self;
  try {
    self = await requireSelfStudent();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const achievements = await getAchievements(self);
  return (
    <AppShell eyebrow="Desafios" title="Suas conquistas" navItems={self.role === "ALUNO" ? ALUNO_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
      <AchievementsView achievements={achievements} />
    </AppShell>
  );
}
