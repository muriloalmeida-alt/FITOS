import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { LogoutButton } from "../../LogoutButton";
import { loadLibrary } from "../../_workout-builder/editorData";
import { RetroWorkoutFlow } from "../../meus-treinos/registrar/RetroWorkoutFlow";
import { selfForPage } from "../selfPage";

export const metadata: Metadata = {
  title: `Registrar treino realizado — ${appName}`,
};

/// Registrar treino realizado (feature 2): aluno com vínculo ativo ou
/// Livre, sempre para si. Desligado sem `FEATURE_RETROATIVO=on`.
export default async function RegistrarTreinoRealizadoPage() {
  if (!featureEnabled("RETROATIVO")) notFound();
  const self = await selfForPage();
  return (
    <AppShell eyebrow="Treino" title="Registrar treino realizado" navItems={self.navItems} activeKey={self.role === "ALUNO" ? "progresso" : "treinos"} trailing={<LogoutButton />}>
      <RetroWorkoutFlow library={await loadLibrary(self.tenantId)} nowIso={new Date().toISOString()} pointsEnabled={featureEnabled("GAMIFICACAO")} />
    </AppShell>
  );
}
