import { requirePersonal } from "@/modules/tenancy/authContext";
import { approveCoachProgression } from "@/modules/execution/progression";
import { workoutErrorResponse } from "../../../_workoutErrors";

/// O personal aprova "subir a carga" (EPIC-44): `{ itemId, toKg }`.
/// Devolve a versão anterior da cópia, para Desfazer.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    if (typeof body?.itemId !== "string" || typeof body?.toKg !== "number") return Response.json({ error: "VALIDACAO", message: "Sugestão inválida." }, { status: 400 });
    return Response.json(await approveCoachProgression({ tenantId: ctx.tenantId, actorUserId: ctx.userId, studentId: (await params).id, itemId: body.itemId, toKg: body.toKg }));
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
