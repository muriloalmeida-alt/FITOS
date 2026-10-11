import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { getHealthForm } from "@/modules/students/healthForm";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";
import { HealthFormEditor } from "../_health/HealthFormEditor";

export const metadata: Metadata = { title: `Ficha de saúde — ${appName}` };

/// Ficha de saúde do aluno (EPIC-46): responder ou atualizar.
export default async function SaudePage() {
  let ctx;
  try {
    ctx = await requireStudent();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const form = await getHealthForm({ tenantId: ctx.tenantId, studentId: ctx.studentId });
  return (
    <AppShell eyebrow="Ficha de saúde" title={form ? "Atualizar ficha" : "Sua ficha de saúde"} navItems={ALUNO_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
      <HealthFormEditor initial={form?.answers ?? null} endpoint="/api/ficha-saude" doneHref="/painel" />
    </AppShell>
  );
}
