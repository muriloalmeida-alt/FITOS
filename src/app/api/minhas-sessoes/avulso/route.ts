import { authErrorResponse } from "@/modules/tenancy/authContext";
import { startOrResumeFreeWorkoutSession } from "@/modules/execution/freeWorkout";
import { individualExecutor } from "../../_execution/individualExecutor";

/// Treino avulso do FitOS Livre: começa (ou retoma) uma sessão sem
/// exercícios; o praticante informa cada um durante o treino.
export async function POST() {
  try {
    const session = await startOrResumeFreeWorkoutSession(await individualExecutor());
    return Response.json({ id: session.id }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
