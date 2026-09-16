import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { cancelInvitation, generateInvitation, InvitationError } from "@/modules/students/invitations";

function activationLink(rawToken: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return `${baseUrl}/ativar-conta?token=${rawToken}`;
}

/// Gera um convite para o aluno do tenant do personal autenticado. O link
/// (com o token bruto) é retornado **apenas nesta resposta** — nunca fica
/// recuperável depois; o personal precisa copiá-lo agora ou gerar outro.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const { invitation, rawToken } = await generateInvitation({ tenantId: ctx.tenantId, studentId: id, actorUserId: ctx.userId });

    return Response.json({ link: activationLink(rawToken), expiresAt: invitation.expiresAt }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof InvitationError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}

/// Cancela o convite pendente do aluno (idempotente).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    await cancelInvitation({ tenantId: ctx.tenantId, studentId: id, actorUserId: ctx.userId });

    return Response.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
