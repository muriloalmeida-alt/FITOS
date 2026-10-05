import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getLibrary } from "@/modules/library/library";
import { listAssignableStudents } from "@/modules/workouts/workouts";
import { TrainingTabs } from "../_workout-builder/TrainingTabs";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { LibraryView, type LibraryTab } from "./LibraryView";

export const metadata: Metadata = {
  title: `Biblioteca — ${appName}`,
};

const TABS: LibraryTab[] = ["programas", "treinos", "aerobicos"];

interface TreinosPageProps {
  searchParams?: Promise<{ aba?: string; aluno?: string }>;
}

/// Biblioteca do Personal (EPIC-28): programas, treinos e aeróbicos
/// prontos para aplicar a um ou mais alunos. `?aluno=` já deixa um aluno
/// escolhido (vindo do perfil dele).
export default async function TreinosPage({ searchParams }: TreinosPageProps = {}) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const sp = (await searchParams) ?? {};
  const tab = TABS.includes(sp.aba as LibraryTab) ? (sp.aba as LibraryTab) : "programas";
  const [library, students] = await Promise.all([getLibrary({ tenantId: ctx.tenantId }), listAssignableStudents({ tenantId: ctx.tenantId })]);
  const preselected = students.some((student) => student.id === sp.aluno) ? sp.aluno! : null;

  return (
    <AppShell eyebrow="Treinos" title="Biblioteca" navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <TrainingTabs active="treinos" />
      <LibraryView
        tab={tab}
        entries={{ programas: library.programs, treinos: library.workouts, aerobicos: library.cardio }}
        students={students.map((student) => ({ id: student.id, name: student.displayName }))}
        preselectedStudentId={preselected}
      />
    </AppShell>
  );
}
