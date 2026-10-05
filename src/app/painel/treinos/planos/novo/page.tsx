import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { ProgramEditor } from "../ProgramEditor";
import { loadProgramData } from "../programData";

export const metadata: Metadata = {
  title: `Montar programa — ${appName}`,
};

/// "Montar um programa" (FIT-146): abre direto a tela do programa; ele só
/// é criado no primeiro gesto (nome, vigência ou adicionar treino).
export default async function NovoProgramaPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }
  const data = await loadProgramData(ctx.tenantId, null);
  return <ProgramEditor initial={null} {...data} />;
}
