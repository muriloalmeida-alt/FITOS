import "server-only";
import { redirect } from "next/navigation";
import { AuthError } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "./navigation";

/// Telas de "eu" (pesar, meta) para o aluno e para o FitOS Livre (EPIC-30).
export async function selfPage() {
  try {
    const ctx = await requireSelfStudent();
    const livre = ctx.role === "INDIVIDUAL";
    return { ...ctx, livre, navItems: livre ? INDIVIDUAL_NAV_ITEMS : ALUNO_NAV_ITEMS, progressHref: livre ? "/painel/minha-evolucao" : "/painel/progresso" };
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
}
