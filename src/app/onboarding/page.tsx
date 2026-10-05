import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { EntradaShell } from "../_entrada/EntradaShell";
import { LivreComecar } from "../comecar/LivreComecar";

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

  const plans = await listActivePlansForAudience("INDIVIDUAL");
  const plan = plans[0] ?? null;
  return (
    <EntradaShell>
      <LivreComecar signedIn priceCents={plan?.priceCents ?? null} trialDays={plan?.trialDays ?? null} />
    </EntradaShell>
  );
}
