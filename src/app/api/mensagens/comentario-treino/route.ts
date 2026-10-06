import { commentOnWorkout, requireChatViewer } from "@/modules/messages/messages";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Comentário do aluno depois do treino (EPIC-42): `{ sessionId, body }`.
export async function POST(request: Request) {
  try {
    const viewer = await requireChatViewer();
    const body = await request.json().catch(() => null);
    return Response.json(await commentOnWorkout(viewer, { sessionId: body?.sessionId, body: body?.body }), { status: 201 });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
