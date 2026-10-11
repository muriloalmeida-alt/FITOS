import "server-only";
import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { featureEnabled } from "@/shared/config/features";
import { FriendGroupError, type FriendSelf } from "./friendGroups";

const STATUS = { VALIDACAO: 400, PROIBIDO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

/// Rotas de Amigos: 404 sem `FEATURE_GAMIFICACAO`, sempre sobre quem
/// treina (aluno com vínculo ativo ou Livre), nunca sobre o corpo.
export async function withFriendSelf(handler: (self: FriendSelf) => Promise<Response>): Promise<Response> {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const self = await requireSelfStudent();
    return await handler({ userId: self.userId, tenantId: self.tenantId, studentId: self.studentId });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof FriendGroupError) return Response.json({ error: error.kind, message: error.message }, { status: STATUS[error.kind] });
    throw error;
  }
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
}
