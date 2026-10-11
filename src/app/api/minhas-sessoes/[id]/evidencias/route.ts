import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { photoErrorResponse } from "@/modules/media/photoAccess";
import { addSessionEvidence, listSessionEvidence } from "@/modules/execution/evidence";

/// Fotos de evidência do próprio treino (Fase 0): aluno com vínculo ativo
/// ou praticante do Livre, sempre sobre si.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const self = await requireSelfStudent();
    return Response.json({ evidences: await listSessionEvidence(self, (await params).id) });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// `multipart/form-data` com `foto`, `largura` e `altura` (reduzida no aparelho).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const self = await requireSelfStudent();
    const form = await request.formData().catch(() => null);
    const file = form?.get("foto");
    if (!form || !(file instanceof Blob)) return Response.json({ error: "VALIDACAO", message: "Escolha uma foto." }, { status: 400 });
    const { evidence, created } = await addSessionEvidence({
      ...self,
      sessionId: (await params).id,
      width: Number(form.get("largura")),
      height: Number(form.get("altura")),
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json({ evidence }, { status: created ? 201 : 200 });
  } catch (error) {
    const response = photoErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
