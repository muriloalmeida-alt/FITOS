import { requirePersonal } from "@/modules/tenancy/authContext";
import { setTenantPrescription } from "@/modules/workouts/workouts";
import { workoutErrorResponse } from "../../_workoutErrors";

/// Prescrição com que um exercício entra num treino (EPIC-36):
/// `{ sets, reps, restSeconds }`.
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const prescription = await setTenantPrescription({ tenantId: ctx.tenantId, sets: Number(body?.sets), reps: Number(body?.reps), restSeconds: Number(body?.restSeconds) });
    return Response.json(prescription);
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
