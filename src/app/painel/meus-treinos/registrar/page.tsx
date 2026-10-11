import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { loadLibrary } from "../../_workout-builder/editorData";
import { RetroWorkoutFlow } from "./RetroWorkoutFlow";

export const metadata: Metadata = {
  title: `Registrar treino realizado — ${appName}`,
};

/// Registrar treino realizado (feature 2) no FitOS Livre: treino que já
/// aconteceu, até 7 dias atrás. Desligado sem `FEATURE_RETROATIVO=on`.
export default async function RegistrarTreinoPage() {
  if (!featureEnabled("RETROATIVO")) notFound();
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  return (
    <AppShell eyebrow="Treino" title="Registrar treino realizado" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <RetroWorkoutFlow library={await loadLibrary(ctx.tenantId)} nowIso={new Date().toISOString()} pointsEnabled={featureEnabled("GAMIFICACAO")} />
    </AppShell>
  );
}
