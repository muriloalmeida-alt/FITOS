import { photoErrorResponse, resolvePhotoViewer } from "@/modules/media/photoAccess";
import { deleteEvolutionPhotoForViewer, getEvolutionPhotoForViewer } from "@/modules/media/photos";

/// Foto de evolução (EPIC-35): só o personal do tenant, o próprio aluno e
/// o praticante do Livre. Nunca em cache compartilhado.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await resolvePhotoViewer();
    const photo = await getEvolutionPhotoForViewer(viewer, (await params).id);
    if (!photo) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
    return new Response(new Uint8Array(photo.data), {
      headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await resolvePhotoViewer();
    await deleteEvolutionPhotoForViewer(viewer, (await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
