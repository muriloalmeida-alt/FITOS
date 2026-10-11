import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { SessionError } from "@/modules/execution/sessions";
import { updateRetroactiveWorkout, type RetroExerciseInput } from "@/modules/execution/retroactive";
import { parseRetroExercises } from "@/shared/lib/retroactive";
import { featureEnabled } from "@/shared/config/features";

/// Edita o próprio treino registrado (feature 2, parte 2): data, duração,
/// exercícios e séries, dentro do prazo. A versão anterior fica na trilha
/// e os pontos são recalculados.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!featureEnabled("RETROATIVO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const self = await requireSelfStudent();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const result = await updateRetroactiveWorkout({
      tenantId: self.tenantId,
      studentId: self.studentId,
      actorUserId: self.userId,
      sessionId: (await params).id,
      performedAt: new Date(typeof body?.performedAt === "string" ? body.performedAt : NaN),
      durationSeconds: typeof body?.durationSeconds === "number" ? body.durationSeconds : 0,
      exercises: parseRetroExercises(body?.exercises) as RetroExerciseInput[],
    });
    return Response.json(result);
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
