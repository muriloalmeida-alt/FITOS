import { requireIndividual } from "@/modules/tenancy/authContext";
import { copyReadyItem } from "@/modules/library/readyLibrary";
import { workoutErrorResponse } from "../../_workoutErrors";

/// Usa um item da biblioteca pronta no FitOS Livre: `{ kind, key }`.
/// Treino ou aeróbico entra em "Meus treinos"; programa troca os treinos
/// ativos (os anteriores vão para Arquivados).
export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);
    const kind = body?.kind === "programa" || body?.kind === "treino" ? body.kind : null;
    if (!kind || typeof body.key !== "string" || !body.key) {
      return Response.json({ error: "VALIDACAO", message: "Escolha um item da biblioteca." }, { status: 400 });
    }
    const result = await copyReadyItem({ tenantId: ctx.tenantId, kind, key: body.key });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
