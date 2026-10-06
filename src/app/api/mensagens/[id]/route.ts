import { postMessage, requireChatViewer, setResolved } from "@/modules/messages/messages";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Responde no assunto (EPIC-39): `{ body }`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireChatViewer();
    const body = await request.json().catch(() => null);
    return Response.json(await postMessage(viewer, (await params).id, body?.body), { status: 201 });
  } catch (error) {
    return chatErrorResponse(error);
  }
}

/// Marca o assunto como resolvido ou reabre: `{ resolved }`.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireChatViewer();
    const body = await request.json().catch(() => null);
    await setResolved(viewer, (await params).id, body?.resolved === true);
    return Response.json({ ok: true });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
