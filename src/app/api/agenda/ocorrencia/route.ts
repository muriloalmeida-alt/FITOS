import { requirePersonal } from "@/modules/tenancy/authContext";
import { rescheduleOccurrence, setOccurrenceStatus } from "@/modules/schedule/schedule";
import { scheduleErrorResponse } from "@/modules/schedule/scheduleErrors";

/// Situação de uma aula (EPIC-48): `{ ref, status, note? }`, ou remarcar
/// com `{ ref, date, startMinutes }`.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = (await request.json().catch(() => null)) ?? {};
    if (body.date !== undefined) return Response.json(await rescheduleOccurrence({ tenantId: ctx.tenantId, actorUserId: ctx.userId, ref: body.ref, date: body.date, startMinutes: body.startMinutes }));
    await setOccurrenceStatus({ tenantId: ctx.tenantId, actorUserId: ctx.userId, ref: body.ref, status: body.status, note: body.note });
    return Response.json({ ok: true });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}
