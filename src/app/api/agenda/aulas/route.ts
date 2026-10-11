import { requirePersonal } from "@/modules/tenancy/authContext";
import { createExtra } from "@/modules/schedule/schedule";
import { scheduleErrorResponse } from "@/modules/schedule/scheduleErrors";

/// Aula avulsa (EPIC-48): `{ studentId, date, startMinutes, durationMinutes?, note? }`.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = (await request.json().catch(() => null)) ?? {};
    return Response.json(await createExtra({ tenantId: ctx.tenantId, actorUserId: ctx.userId, studentId: body.studentId, date: body.date, startMinutes: body.startMinutes, durationMinutes: body.durationMinutes, note: body.note }), { status: 201 });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}
