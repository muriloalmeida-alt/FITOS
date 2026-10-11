import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { InviteLinkError, regenerateInviteCode, setInviteDefaults } from "@/modules/students/inviteLink";

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

/// O que quem entra pelo link já recebe (EPIC-33): programa e mensalidade.
/// `null` tira; ausente mantém.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }
    const pick = <T,>(value: unknown, valid: (v: unknown) => v is T): T | null | undefined => (value === undefined ? undefined : value === null ? null : valid(value) ? value : undefined);
    const isString = (v: unknown): v is string => typeof v === "string";
    const isNumber = (v: unknown): v is number => typeof v === "number";
    const defaults = await setInviteDefaults({
      tenantId: ctx.tenantId,
      programId: pick(body.programId, isString),
      feeCents: pick(body.feeCents, isNumber),
      feeDay: pick(body.feeDay, isNumber),
    });
    return Response.json(defaults);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof InviteLinkError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
