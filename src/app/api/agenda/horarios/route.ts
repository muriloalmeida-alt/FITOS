import { requirePersonal } from "@/modules/tenancy/authContext";
import { createSlots } from "@/modules/schedule/schedule";
import { scheduleErrorResponse } from "@/modules/schedule/scheduleErrors";

/// Horário fixo (EPIC-48): `{ studentId, weekdays, startMinutes, durationMinutes?, location? }`.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = (await request.json().catch(() => null)) ?? {};
    return Response.json(await createSlots({ tenantId: ctx.tenantId, studentId: body.studentId, weekdays: body.weekdays, startMinutes: body.startMinutes, durationMinutes: body.durationMinutes, location: body.location }), { status: 201 });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}
