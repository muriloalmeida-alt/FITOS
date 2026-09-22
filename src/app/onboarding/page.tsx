import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { OnboardingForm } from "./OnboardingForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Configurar seu espaço — ${appName}`,
};

/// Tela 2 (Onboarding) do "Treino sozinho" (FIT-101): objetivo, experiência
/// e disponibilidade — a "configuração inicial" exigida pelo pacote,
/// deliberadamente sem nenhuma alegação de prescrição personalizada. Só
/// para `INDIVIDUAL` (mesmo padrão de decisão server-side de `/painel`,
/// FIT-012): quem não está autenticado vai para `/entrar`; quem está
/// autenticado com outro papel vai para `/painel` (essa pessoa já tem seu
/// próprio destino, não este).
export default async function OnboardingPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }
  if (ctx.role !== "INDIVIDUAL") {
    redirect("/painel");
  }

  const existingProfile = await getIndividualOnboardingProfile(ctx.tenantId);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Configure seu espaço</h1>
          <p className={styles.subtitle}>
            Essas respostas ajudam a organizar sua experiência — não geram nenhuma prescrição automática
            de treino.
          </p>
        </header>

        <OnboardingForm
          initialObjective={existingProfile?.objective ?? null}
          initialExperienceLevel={existingProfile?.experienceLevel ?? null}
          initialWeeklyAvailability={existingProfile?.weeklyAvailability ?? null}
        />
      </div>
    </main>
  );
}
