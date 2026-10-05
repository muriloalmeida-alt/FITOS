import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { EntradaShell } from "../_entrada/EntradaShell";
import { PersonalComecar } from "../comecar/PersonalComecar";

export const metadata: Metadata = {
  title: `Seu espaço — ${appName}`,
};

/// Retomar o cadastro do personal (EPIC-33): quem criou a conta mas não
/// concluiu responde só "quantos alunos hoje?" e segue para o primeiro
/// aluno. Só `PERSONAL`; sem sessão vai para `/entrar`.
export default async function OnboardingPersonalPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }
  if (ctx.role !== "PERSONAL") {
    redirect("/painel");
  }

  const plans = await listActivePlansForAudience("PERSONAL");
  return (
    <EntradaShell>
      <PersonalComecar signedIn plans={plans.map((plan) => ({ id: plan.id, name: plan.name, priceCents: plan.priceCents, studentLimit: plan.studentLimit }))} />
    </EntradaShell>
  );
}
