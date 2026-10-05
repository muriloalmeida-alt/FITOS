import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { regenerateInviteCode } from "@/modules/students/inviteLink";

/// Gera um link de convite novo; o anterior deixa de funcionar (EPIC-29).
export async function POST() {
  try {
    const ctx = await requirePersonal();
    return Response.json({ code: await regenerateInviteCode(ctx.tenantId) }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
