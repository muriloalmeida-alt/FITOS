import { AuthError } from "@/modules/tenancy/authContext";
import { requireChatViewer } from "@/modules/messages/messages";
import { setQuickReplies } from "@/modules/messages/quickReplies";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Salva as respostas rápidas do personal (EPIC-41): `{ replies: string[] }`.
export async function PUT(request: Request) {
  try {
    const viewer = await requireChatViewer();
    if (viewer.role !== "PERSONAL") throw new AuthError("FORBIDDEN", "Só o personal tem respostas rápidas.");
    const body = await request.json().catch(() => null);
    return Response.json({ replies: await setQuickReplies(viewer.tenantId, body?.replies) });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
