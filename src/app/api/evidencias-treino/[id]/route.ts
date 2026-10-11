import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { photoErrorResponse, resolvePhotoViewer } from "@/modules/media/photoAccess";
import { deleteSessionEvidence, getEvidenceForViewer } from "@/modules/execution/evidence";

/// Foto de evidência do treino: o próprio aluno/Livre e o personal do
/// espaço veem; nunca em cache compartilhado.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await resolvePhotoViewer();
    const photo = await getEvidenceForViewer(viewer, (await params).id);
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

/// Só quem treinou exclui a própria evidência.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const self = await requireSelfStudent();
    return Response.json(await deleteSessionEvidence(self, (await params).id));
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
