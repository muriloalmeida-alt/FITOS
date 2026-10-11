import { requireChatViewer } from "@/modules/messages/messages";
import { getAttachment, rangeResponse } from "@/modules/messages/attachments";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Lê o anexo da conversa (EPIC-40), só para quem participa dela.
export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  try {
    const viewer = await requireChatViewer();
    const attachment = await getAttachment(viewer, (await params).attachmentId);
    return rangeResponse(attachment.data, attachment.mimeType, request.headers.get("range"));
  } catch (error) {
    return chatErrorResponse(error);
  }
}
