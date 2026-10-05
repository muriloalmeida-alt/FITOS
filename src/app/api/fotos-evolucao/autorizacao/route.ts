import { photoErrorResponse, resolvePhotoTarget } from "@/modules/media/photoAccess";
import { recordPhotoConsent, revokePhotoConsent } from "@/modules/media/photos";

/// Autorização para fotos de evolução (EPIC-35). POST registra (o aluno
/// autoriza, ou o personal declara que o aluno autorizou); DELETE retira e
/// apaga as fotos. Corpo: `{ aluno }` só para o personal.
async function target(request: Request) {
  const body = await request.json().catch(() => null);
  return resolvePhotoTarget(typeof body?.aluno === "string" && body.aluno ? body.aluno : null);
}

export async function POST(request: Request) {
  try {
    const scope = await target(request);
    await recordPhotoConsent({ ...scope, actorUserId: scope.userId });
    return Response.json({ ok: true });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = await target(request);
    await revokePhotoConsent(scope);
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
