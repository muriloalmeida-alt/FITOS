import { requireChatViewer } from "@/modules/messages/messages";
import { postAttachment } from "@/modules/messages/attachments";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Vídeo da execução ou foto na conversa (EPIC-40): multipart com
/// `file`, e opcionais `caption`, `durationSec`, `width`, `height`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireChatViewer();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
    const message = await postAttachment(viewer, (await params).id, {
      bytes,
      caption: form?.get("caption") ?? "",
      durationSec: form?.get("durationSec"),
      width: form?.get("width"),
      height: form?.get("height"),
    });
    return Response.json(message, { status: 201 });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
