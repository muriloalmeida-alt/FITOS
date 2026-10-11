import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { setClassRankingEnabled } from "@/modules/gamification/classRanking";
import { featureEnabled } from "@/shared/config/features";
import { rankingErrorResponse } from "../_errors";

/// Personal liga ou desliga o ranking da turma (ligar começa temporada nova).
export async function PATCH(request: Request) {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    const ctx = await requireSession();
    if (ctx.role !== "PERSONAL") throw new AuthError("FORBIDDEN", "Só o personal liga o ranking da turma.");
    const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
    if (typeof body?.enabled !== "boolean") return Response.json({ error: "VALIDACAO", message: "Informe se o ranking fica ligado." }, { status: 400 });
    return Response.json(await setClassRankingEnabled(ctx.tenantId, body.enabled));
  } catch (error) {
    return rankingErrorResponse(error);
  }
}
