import { requirePersonal } from "@/modules/tenancy/authContext";
import { endSlot } from "@/modules/schedule/schedule";
import { scheduleErrorResponse } from "@/modules/schedule/scheduleErrors";

/// Encerra o horário fixo (EPIC-48); o histórico fica.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    await endSlot({ tenantId: ctx.tenantId, slotId: (await params).id });
    return Response.json({ ok: true });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}
