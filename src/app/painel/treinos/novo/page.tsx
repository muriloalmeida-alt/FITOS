import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { loadLibrary, loadPrograms } from "../../_workout-builder/editorData";
import { PersonalWorkoutEditor } from "../PersonalWorkoutEditor";
import { getTenantPrescription } from "@/modules/workouts/workouts";

export const metadata: Metadata = {
  title: `Montar treino — ${appName}`,
};

interface NovoTreinoPageProps {
  searchParams?: Promise<{ programa?: string }>;
}

/// "Montar um treino" (FIT-146): abre direto o editor, sem formulário
/// prévio. O treino só é criado no primeiro gesto (nome ou exercícios).
/// `?programa=<id>` vem de "Montar um treino novo" na semana do programa:
/// "Pronto" coloca o treino lá e volta.
export default async function NovoTreinoPage({ searchParams }: NovoTreinoPageProps = {}) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const programa = (await searchParams)?.programa ?? null;
  const [library, programs, prescription] = await Promise.all([loadLibrary(ctx.tenantId), loadPrograms(ctx.tenantId), getTenantPrescription(ctx.tenantId)]);

  return <PersonalWorkoutEditor initial={null} library={library} programs={programs} returnToProgramId={programa} prescription={prescription} />;
}
