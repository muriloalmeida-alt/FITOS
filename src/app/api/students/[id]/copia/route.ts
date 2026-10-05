import { requirePersonal } from "@/modules/tenancy/authContext";
import { reviseStudentCopy, type CopyEdit } from "@/modules/library/studentCopy";
import { CARDIO_INTENSITIES, type CardioIntensity } from "@/shared/lib/cardio";
import { workoutErrorResponse } from "../../../_workoutErrors";

const str = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined);

function parseEdit(body: Record<string, unknown> | null): CopyEdit | null {
  if (!body) return null;
  const intensity = CARDIO_INTENSITIES.includes(body.intensity as CardioIntensity) ? (body.intensity as CardioIntensity) : undefined;
  switch (body.kind) {
    case "swap":
      return str(body.itemId) && str(body.exerciseId) ? { kind: "swap", itemId: body.itemId as string, exerciseId: body.exerciseId as string } : null;
    case "update":
      return str(body.itemId) ? { kind: "update", itemId: body.itemId as string, sets: int(body.sets), reps: int(body.reps), durationSeconds: int(body.durationSeconds), intensity } : null;
    case "addItem":
      return str(body.workoutId) && str(body.exerciseId) ? { kind: "addItem", workoutId: body.workoutId as string, exerciseId: body.exerciseId as string } : null;
    case "removeItem":
      return str(body.itemId) ? { kind: "removeItem", itemId: body.itemId as string } : null;
    case "addWorkout":
      return str(body.sourceWorkoutId) ? { kind: "addWorkout", sourceWorkoutId: body.sourceWorkoutId as string } : null;
    default:
      return null;
  }
}

/// Ajusta a cópia do aluno: gera uma nova versão e devolve a anterior,
/// para Desfazer (ADR-016).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const edit = parseEdit(await request.json().catch(() => null));
    if (!edit) return Response.json({ error: "VALIDACAO", message: "Ajuste inválido." }, { status: 400 });
    const result = await reviseStudentCopy({ tenantId: ctx.tenantId, actorUserId: ctx.userId, studentId: id, edit });
    return Response.json(result);
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
