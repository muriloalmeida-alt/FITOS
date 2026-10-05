import { requireSubscriber } from "@/modules/tenancy/authContext";
import { listSwapOptions } from "@/modules/exercises/exercises";
import { workoutErrorResponse } from "../../../_workoutErrors";

/// Outros exercícios do mesmo grupo muscular (aeróbico: outros aeróbicos)
/// para trocar na cópia do aluno ou no treino do Livre (EPIC-28).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSubscriber();
    const { id } = await params;
    return Response.json({ options: await listSwapOptions({ tenantId: ctx.tenantId, exerciseId: id }) });
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
