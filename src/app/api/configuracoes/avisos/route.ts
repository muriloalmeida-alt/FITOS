import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { AlertSettingsError, setAlertSettings } from "@/modules/notifications/personalAlerts";

/// Avisos que o personal quer receber (EPIC-36). Campos ausentes ficam
/// como estão.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }
    const settings = await setAlertSettings(ctx.userId, {
      daysChanged: body.daysChanged,
      inactiveDays: body.inactiveDays,
      overdue: body.overdue,
      programEnd: body.programEnd,
    });
    return Response.json(settings);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AlertSettingsError) return Response.json({ error: "VALIDACAO", message: error.message }, { status: 400 });
    throw error;
  }
}
