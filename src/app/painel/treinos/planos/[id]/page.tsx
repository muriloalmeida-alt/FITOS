import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getTrainingPlanForTenant } from "@/modules/workouts/workouts";
import { ProgramEditor } from "../ProgramEditor";
import { loadProgramData } from "../programData";

export const metadata: Metadata = {
  title: `Programa — ${appName}`,
};

/// Programa do Personal (FIT-146). Busca sempre pelo tenant da sessão e
/// nunca um snapshot — programa de outro tenant (ou cópia atribuída) é 404.
export default async function ProgramaPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const plan = await getTrainingPlanForTenant({ tenantId: ctx.tenantId, trainingPlanId: id });
  if (!plan || plan.isDraftBucket) {
    notFound();
  }
  const data = await loadProgramData(ctx.tenantId, plan.id);
  return <ProgramEditor initial={{ id: plan.id, name: plan.name, durationWeeks: plan.durationWeeks, status: plan.status }} {...data} />;
}
