import { requireSession } from "@/modules/tenancy/authContext";
import { photoErrorResponse } from "@/modules/media/photoAccess";
import { removeUserAvatar, setUserAvatar } from "@/modules/media/photos";

/// Foto de perfil da própria conta (EPIC-35), qualquer papel.
/// `multipart/form-data` com `foto`, já quadrada e reduzida no aparelho.
export async function POST(request: Request) {
  try {
    const ctx = await requireSession();
    const form = await request.formData().catch(() => null);
    const file = form?.get("foto");
    if (!(file instanceof Blob)) {
      return Response.json({ error: "VALIDACAO", message: "Escolha uma foto." }, { status: 400 });
    }
    const image = await setUserAvatar({ userId: ctx.userId, bytes: new Uint8Array(await file.arrayBuffer()) });
    return Response.json({ image });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE() {
  try {
    const ctx = await requireSession();
    await removeUserAvatar(ctx.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
