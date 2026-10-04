import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { loadLibrary } from "../../_workout-builder/editorData";
import { LivreWorkoutEditor } from "../LivreWorkoutEditor";

export const metadata: Metadata = {
  title: `Montar treino — ${appName}`,
};

/// "Montar meu treino" (FIT-157): abre direto o editor, sem formulário. O
/// treino só é criado no primeiro gesto.
export default async function NovoMeuTreinoPage() {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }
  return <LivreWorkoutEditor initial={null} library={await loadLibrary(ctx.tenantId)} />;
}
