import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { getFinishedSessionForSelf } from "@/modules/execution/finishedSession";
import { LogoutButton } from "../../../LogoutButton";
import { loadLibrary } from "../../../_workout-builder/editorData";
import { RetroWorkoutFlow } from "../../../meus-treinos/registrar/RetroWorkoutFlow";
import { selfForPage } from "../../../selfPage";

export const metadata: Metadata = {
  title: `Editar treino registrado — ${appName}`,
};

/// Editar o próprio treino registrado (feature 2, parte 2), dentro do
/// prazo. Fora dele, volta para o detalhe.
export default async function EditarTreinoRealizadoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!featureEnabled("RETROATIVO")) notFound();
  const self = await selfForPage();
  const { id } = await params;
  const detail = await getFinishedSessionForSelf(self.scope, id);
  if (!detail) notFound();
  if (!detail.editable) redirect(`/painel/treinos-realizados/${id}`);
  const library = await loadLibrary(self.tenantId);
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
  return (
    <AppShell eyebrow="Treino" title="Editar treino registrado" navItems={self.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <RetroWorkoutFlow
        library={library}
        nowIso={new Date().toISOString()}
        pointsEnabled={featureEnabled("GAMIFICACAO")}
        edit={{
          sessionId: detail.id,
          performedAtIso: detail.performedAt.toISOString(),
          durationSeconds: detail.durationSeconds ?? 45 * 60,
          items: detail.exercises.map((item) => ({ exercise: byId.get(item.exerciseId) ?? { id: item.exerciseId, name: item.name, muscle: null, imageUrl: null, imageAlt: null, type: item.type }, sets: item.sets })),
        }}
      />
    </AppShell>
  );
}
