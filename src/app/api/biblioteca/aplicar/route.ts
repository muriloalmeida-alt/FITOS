import { requirePersonal } from "@/modules/tenancy/authContext";
import { applyLibraryItem } from "@/modules/library/library";
import { workoutErrorResponse } from "../../_workoutErrors";

/// Aplica um item da biblioteca (programa, treino ou aeróbico) a vários
/// alunos. Cada aluno recebe a própria cópia (EPIC-28).
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const kind = body?.kind === "programa" || body?.kind === "treino" ? body.kind : null;
    if (!kind || typeof body.id !== "string" || !Array.isArray(body.studentIds) || !body.studentIds.every((value: unknown) => typeof value === "string")) {
      return Response.json({ error: "VALIDACAO", message: "Escolha o item e os alunos." }, { status: 400 });
    }
    const result = await applyLibraryItem({ tenantId: ctx.tenantId, actorUserId: ctx.userId, kind, id: body.id, studentIds: body.studentIds });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
