import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { getReadyLibrary } from "@/modules/library/readyLibrary";
import { TrainingTabs } from "../../_workout-builder/TrainingTabs";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { LibraryView, type LibraryTab } from "../../treinos/LibraryView";

export const metadata: Metadata = {
  title: `Biblioteca — ${appName}`,
};

const TABS: LibraryTab[] = ["programas", "treinos", "aerobicos"];

/// Biblioteca do FitOS Livre: os mesmos programas, treinos e aeróbicos
/// prontos do personal, com o filtro de 30, 45 e 60 min. Usar um item
/// copia para "Meus treinos".
export default async function LivreBibliotecaPage({ searchParams }: { searchParams?: Promise<{ aba?: string }> } = {}) {
  try {
    await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const aba = (await searchParams)?.aba;
  const tab = TABS.includes(aba as LibraryTab) ? (aba as LibraryTab) : "programas";
  const library = await getReadyLibrary();

  return (
    <AppShell eyebrow="Treinos" title="Biblioteca" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TrainingTabs active="biblioteca" area="livre" />
      <LibraryView mode="livre" tab={tab} entries={{ programas: library.programs, treinos: library.workouts, aerobicos: library.cardio }} students={[]} />
    </AppShell>
  );
}
