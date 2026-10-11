import "server-only";
import { redirect } from "next/navigation";
import { AuthError } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { ALUNO_NAV_ITEMS, INDIVIDUAL_NAV_ITEMS } from "./navigation";

/// Quem treina (aluno com vínculo ativo ou Livre), com o menu do papel.
export async function selfForPage() {
  try {
    const self = await requireSelfStudent();
    return { ...self, scope: { tenantId: self.tenantId, studentId: self.studentId }, navItems: self.role === "ALUNO" ? ALUNO_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS };
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
}
