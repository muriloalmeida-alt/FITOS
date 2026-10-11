import { requireSession } from "@/modules/tenancy/authContext";
import { photoErrorResponse } from "@/modules/media/photoAccess";
import { getUserAvatar } from "@/modules/media/photos";

/// Foto de perfil (EPIC-35), só para quem está autenticado. A URL leva
/// `?v=` com a data da troca, então pode ficar em cache privado.
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireSession();
    const avatar = await getUserAvatar((await params).userId);
    if (!avatar) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
    return new Response(new Uint8Array(avatar.data), {
      headers: { "Content-Type": avatar.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
