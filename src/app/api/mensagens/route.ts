import { createTopic, requireChatViewer } from "@/modules/messages/messages";
import { chatErrorResponse } from "@/modules/messages/chatErrors";

/// Abre um assunto no chat com a primeira mensagem (EPIC-39):
/// `{ category, body, exerciseId?, exerciseName?, studentId? }`
/// (`studentId` só para o personal).
export async function POST(request: Request) {
  try {
    const viewer = await requireChatViewer();
    const body = await request.json().catch(() => null);
    const topic = await createTopic(viewer, {
      category: body?.category,
      body: body?.body,
      exerciseId: typeof body?.exerciseId === "string" ? body.exerciseId : null,
      exerciseName: typeof body?.exerciseName === "string" ? body.exerciseName : null,
      studentId: typeof body?.studentId === "string" ? body.studentId : null,
    });
    return Response.json(topic, { status: 201 });
  } catch (error) {
    return chatErrorResponse(error);
  }
}
