import { AuthError, authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { getMyModalities, setMyModalities } from "@/modules/students/modalityPreferences";
import { ModalityError } from "@/shared/lib/modalities";

/// Modalidades preferidas (proposta 11) da própria conta: FitOS Livre ou
/// aluno com vínculo ativo. Nunca de outra pessoa; o personal só lê as dos
/// alunos do espaço dele, na ficha do aluno.
async function owner() {
  const ctx = await requireSession();
  if (ctx.role === "INDIVIDUAL") return { role: "INDIVIDUAL" as const, tenantId: ctx.tenantId };
  if (ctx.role === "ALUNO" && ctx.tenantId && ctx.studentId) return { role: "ALUNO" as const, tenantId: ctx.tenantId, studentId: ctx.studentId };
  throw new AuthError("FORBIDDEN", "Só o próprio aluno escolhe as modalidades.");
}

export async function GET() {
  try {
    return Response.json({ modalities: await getMyModalities(await owner()) });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const who = await owner();
    const body = await request.json().catch(() => null);
    return Response.json({ modalities: await setMyModalities(who, body?.modalities) });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof ModalityError) return Response.json({ error: "VALIDACAO", message: error.message }, { status: 400 });
    throw error;
  }
}
