import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { getReminderHour, setReminderHour } from "@/modules/notifications/reminders";

/// Hora do lembrete de treino (EPIC-31); `null` desliga.
export async function GET() {
  try {
    const ctx = await requireSession();
    return Response.json({ reminderHour: await getReminderHour(ctx.userId) });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireSession();
    if (ctx.role !== "ALUNO" && ctx.role !== "INDIVIDUAL") {
      return Response.json({ error: "FORBIDDEN", message: "Lembrete de treino é para quem treina." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const hour = body?.reminderHour;
    if (hour !== null && !(Number.isInteger(hour) && hour >= 0 && hour <= 23)) {
      return Response.json({ error: "VALIDACAO", message: "Escolha uma hora válida." }, { status: 400 });
    }
    await setReminderHour(ctx.userId, hour);
    return Response.json({ reminderHour: hour });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
