import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { SessionError } from "@/modules/execution/sessions";
import { recordRetroactiveWorkout, type RetroExerciseInput } from "@/modules/execution/retroactive";
import { parseRetroBlocksBody, parseRetroExercises } from "@/shared/lib/retroactive";

import { featureEnabled } from "@/shared/config/features";

/// "Registrar treino realizado" (feature 2): quem treinou registra para si
/// (aluno com vínculo ativo ou Livre). Desligado sem `FEATURE_RETROATIVO=on`.
export async function POST(request: Request) {
  if (!featureEnabled("RETROATIVO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const self = await requireSelfStudent();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const result = await recordRetroactiveWorkout({
      tenantId: self.tenantId,
      studentId: self.studentId,
      operationKey: typeof body?.operationKey === "string" ? body.operationKey : "",
      performedAt: new Date(typeof body?.performedAt === "string" ? body.performedAt : NaN),
      durationSeconds: typeof body?.durationSeconds === "number" ? body.durationSeconds : 0,
      // Funcional e CrossFit (etapa 4): blocos só com a flag ligada.
      exercises: parseRetroExercises(body?.exercises, featureEnabled("FUNCIONAL")) as RetroExerciseInput[],
      blocks: featureEnabled("FUNCIONAL") ? parseRetroBlocksBody(body?.blocks) : undefined,
    });
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof SessionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
