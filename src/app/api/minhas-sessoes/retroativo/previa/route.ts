import { authErrorResponse } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { previewPoints } from "@/modules/gamification/sessionScoring";
import { featureEnabled } from "@/shared/config/features";

const MAX_EXERCISES = 30;

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/// "Este treino renderá X pontos" na revisão do registro retroativo
/// (Desafios). Só calcula; não grava nada.
export async function POST(request: Request) {
  if (!featureEnabled("RETROATIVO") || !featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const self = await requireSelfStudent();
    const body = (await request.json().catch(() => null)) as { exercises?: unknown } | null;
    const exercises = (Array.isArray(body?.exercises) ? body.exercises : []).slice(0, MAX_EXERCISES).map((exercise: { exerciseId?: unknown; sets?: unknown }) => ({
      exerciseId: String(exercise?.exerciseId ?? ""),
      sets: (Array.isArray(exercise?.sets) ? exercise.sets : []).slice(0, 50).map((set: { reps?: unknown; loadKg?: unknown; durationSeconds?: unknown }) => ({
        reps: intOrNull(set?.reps),
        loadGrams: typeof set?.loadKg === "number" && set.loadKg >= 0 && set.loadKg <= 1000 ? Math.round(set.loadKg * 1000) : null,
        durationSeconds: intOrNull(set?.durationSeconds),
      })),
    }));
    return Response.json(await previewPoints(self, exercises));
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
