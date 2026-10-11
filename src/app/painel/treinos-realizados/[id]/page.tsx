import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { getFinishedSessionForSelf } from "@/modules/execution/finishedSession";
import { LogoutButton } from "../../LogoutButton";
import { selfForPage } from "../../selfPage";
import { FinishedSessionView } from "./FinishedSessionView";

export const metadata: Metadata = {
  title: `Treino realizado — ${appName}`,
};

/// Detalhe de um treino realizado (feature 2, parte 2): resumo, fotos
/// (anexar depois libera os pontos no prazo), pontos, editar o registro
/// dentro do prazo e excluir. Sempre o próprio treino.
export default async function TreinoRealizadoPage({ params }: { params: Promise<{ id: string }> }) {
  const self = await selfForPage();
  const detail = await getFinishedSessionForSelf(self.scope, (await params).id);
  if (!detail) notFound();
  return (
    <AppShell eyebrow="Treino realizado" title={detail.workoutName} navItems={self.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <FinishedSessionView
        session={{
          id: detail.id,
          mode: detail.mode,
          performedAtIso: detail.performedAt.toISOString(),
          recordedAtIso: detail.recordedAt.toISOString(),
          durationSeconds: detail.durationSeconds,
          exercises: detail.exercises,
          evidenceIds: detail.evidenceIds,
        }}
        canEdit={detail.editable && featureEnabled("RETROATIVO")}
        canDelete={self.role === "INDIVIDUAL" || detail.mode === "RETROATIVO"}
        pointsEnabled={featureEnabled("GAMIFICACAO")}
      />
    </AppShell>
  );
}
