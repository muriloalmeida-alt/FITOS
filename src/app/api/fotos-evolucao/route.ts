import { photoErrorResponse, resolvePhotoTarget } from "@/modules/media/photoAccess";
import { addEvolutionPhoto } from "@/modules/media/photos";

/// Envia uma foto de evolução (EPIC-35): `multipart/form-data` com `foto`,
/// `pose`, `largura`, `altura` e, para o personal, `aluno`.
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("foto");
    if (!form || !(file instanceof Blob)) {
      return Response.json({ error: "VALIDACAO", message: "Escolha uma foto." }, { status: 400 });
    }
    const aluno = form.get("aluno");
    const target = await resolvePhotoTarget(typeof aluno === "string" && aluno ? aluno : null);
    const photo = await addEvolutionPhoto({
      ...target,
      actorUserId: target.userId,
      pose: String(form.get("pose") ?? ""),
      width: Number(form.get("largura")),
      height: Number(form.get("altura")),
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json({ id: photo.id }, { status: 201 });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
