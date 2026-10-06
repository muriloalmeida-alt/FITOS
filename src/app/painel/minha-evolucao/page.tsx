import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionRow, AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { buildEvolution } from "@/modules/evolution/evolutionSeries";
import { listGoalsForStudent } from "@/modules/evolution/goals";
import { getTrainingOverviewForStudent, listPersonalRecordsForStudent, listSessionHistoryForStudent } from "@/modules/execution/history";
import { LogoutButton } from "../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { MinhaEvolucaoView, type EvolutionTab } from "./MinhaEvolucaoView";
import { listEvolutionPhotos } from "@/modules/media/photos";

export const metadata: Metadata = {
  title: `Minha evolução — ${appName}`,
};

/// Minha evolução do FitOS Livre (FIT-159, L4 do protótipo), só do próprio
/// praticante. Aba por `?aba=treinos|corpo|metas`.
export default async function MinhaEvolucaoPage({ searchParams }: { searchParams?: Promise<{ aba?: string }> } = {}) {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
  const scope = { tenantId: ctx.tenantId, studentId: student.id };
  const aba = (await searchParams)?.aba;
  const tab: EvolutionTab = aba === "corpo" || aba === "metas" ? aba : "treinos";
  const [overview, records, history, assessments, goals, photos] = await Promise.all([
    getTrainingOverviewForStudent(scope),
    listPersonalRecordsForStudent(scope),
    listSessionHistoryForStudent(scope),
    listAssessmentsForStudent(scope),
    listGoalsForStudent(scope),
    listEvolutionPhotos(scope),
  ]);

  return (
    <AppShell eyebrow="Evolução" title="Minha evolução" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
      <ActionRow href="/painel/relatorio" title="Relatório do mês" description="Treinos, cargas, corpo e fotos do mês" trailing={<span aria-hidden="true">›</span>} />
      <MinhaEvolucaoView
        tab={tab}
        overview={overview}
        records={[...records]
          .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime())
          .slice(0, 8)
          .map((record) => ({ exerciseName: record.exerciseName, loadKg: record.loadValue, reps: record.repsCompleted, dateIso: record.achievedAt.toISOString() }))}
        history={history.slice(0, 20).map((session) => ({ id: session.id, workoutName: session.workoutName, dateIso: session.startedAt.toISOString(), status: session.status, effort: session.perceivedEffort }))}
        body={buildEvolution(assessments)}
        photos={{ items: photos.map((photo) => ({ id: photo.id, pose: photo.pose, takenIso: photo.takenAt.toISOString() })), consent: Boolean(student.photoConsentAt) }}
        assessments={assessments.map((entry) => ({
          id: entry.id,
          dateIso: entry.recordedAt.toISOString(),
          weightKg: entry.weightGrams !== null ? entry.weightGrams / 1000 : null,
          bodyFatPercent: entry.bodyFatTenthPercent !== null ? entry.bodyFatTenthPercent / 10 : null,
          notes: entry.notes,
        }))}
        goals={goals.map((entry) => ({
          id: entry.id,
          description: entry.description,
          targetIso: entry.targetDate?.toISOString() ?? null,
          status: entry.status,
          closedIso: entry.completedAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
