import { authErrorResponse } from "@/modules/tenancy/authContext";
import { startOrResumeFreeWorkoutSession } from "@/modules/execution/freeWorkout";
import { normalizeFocus } from "@/shared/lib/workoutFocus";
import { individualExecutor } from "../../_execution/individualExecutor";

/// Treino avulso do FitOS Livre: começa (ou retoma) uma sessão sem
/// exercícios; o praticante informa cada um durante o treino. `focus`:
/// o que ele escolheu treinar (regiões e grupos musculares).
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { focus?: unknown } | null;
    const session = await startOrResumeFreeWorkoutSession({ ...(await individualExecutor()), focus: normalizeFocus(body?.focus) });
    return Response.json({ id: session.id }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
