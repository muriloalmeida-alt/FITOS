import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { StudentAccountError, switchToIndividual } from "@/modules/identity/studentAccount";

/// FIT-151: aluno sem vínculo passa a treinar por conta própria (FitOS
/// Livre). Sempre o usuário da sessão.
export async function POST() {
  try {
    const ctx = await requireSession();
    await switchToIndividual({ userId: ctx.userId });
    return Response.json({ ok: true, redirectTo: "/onboarding" });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentAccountError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 409 });
    }
    throw error;
  }
}
