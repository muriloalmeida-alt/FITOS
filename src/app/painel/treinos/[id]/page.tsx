import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { loadEditorWorkout, loadLibrary, loadPrograms } from "../../_workout-builder/editorData";
import { PersonalWorkoutEditor } from "../PersonalWorkoutEditor";

export const metadata: Metadata = {
  title: `Treino — ${appName}`,
};

interface TreinoPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ programa?: string }>;
}

/// Editor de um treino existente (FIT-146). Busca sempre pelo tenant da
/// sessão — treino de outro tenant é 404, sem revelar se o `id` existe.
export default async function TreinoPage({ params, searchParams }: TreinoPageProps) {
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
  const workout = await loadEditorWorkout(ctx.tenantId, id);
  if (!workout) {
    notFound();
  }
  const programa = (await searchParams)?.programa ?? null;
  const [library, programs] = await Promise.all([loadLibrary(ctx.tenantId), loadPrograms(ctx.tenantId)]);

  return <PersonalWorkoutEditor initial={workout} library={library} programs={programs} returnToProgramId={programa} />;
}
