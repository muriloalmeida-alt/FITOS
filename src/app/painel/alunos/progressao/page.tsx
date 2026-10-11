import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { suggestCoachProgressions } from "@/modules/execution/progression";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { CoachProgressionList } from "../../_progression/CoachProgressionList";
import styles from "../risco/Risco.module.css";

export const metadata: Metadata = { title: `Subir a carga — ${appName}` };

/// Progressão sugerida (EPIC-44): todos os alunos prontos para subir a
/// carga, para aprovar de uma vez.
export default async function ProgressaoPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const suggestions = await suggestCoachProgressions({ tenantId: ctx.tenantId });
  return (
    <AppShell eyebrow="Alunos" title="Subir a carga" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Link href="/painel/alunos" className={styles.back}>
        ← Alunos
      </Link>
      {suggestions.length === 0 ? <p className={styles.empty}>Nenhuma sugestão agora. Aparece quando um aluno faz todas as repetições com a mesma carga duas vezes seguidas, sem achar pesado.</p> : <CoachProgressionList suggestions={suggestions} />}
    </AppShell>
  );
}
