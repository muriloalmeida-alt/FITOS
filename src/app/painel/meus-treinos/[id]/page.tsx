import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { loadEditorWorkout, loadLibrary } from "../../_workout-builder/editorData";
import { LivreWorkoutEditor } from "../LivreWorkoutEditor";

export const metadata: Metadata = {
  title: `Treino — ${appName}`,
};

/// Editor de um treino do FitOS Livre (FIT-157). Sempre pelo tenant da
/// sessão: treino de outro tenant é 404.
export default async function MeuTreinoPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const workout = await loadEditorWorkout(ctx.tenantId, id);
  if (!workout) {
    notFound();
  }
  return <LivreWorkoutEditor initial={workout} library={await loadLibrary(ctx.tenantId)} />;
}
