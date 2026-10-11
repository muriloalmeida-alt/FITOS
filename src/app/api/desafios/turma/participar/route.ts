import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { joinClassRanking, leaveClassRanking } from "@/modules/gamification/classRanking";
import { featureEnabled } from "@/shared/config/features";
import { rankingErrorResponse } from "../../_errors";

async function aluno() {
  const ctx = await requireSession();
  if (ctx.role !== "ALUNO" || !ctx.tenantId || !ctx.studentId) throw new AuthError("FORBIDDEN", "Só alunos com personal participam do ranking da turma.");
  return { tenantId: ctx.tenantId, studentId: ctx.studentId };
}

/// Aluno entra no ranking da turma (adesão voluntária).
export async function POST() {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    await joinClassRanking(await aluno());
    return new Response(null, { status: 204 });
  } catch (error) {
    return rankingErrorResponse(error);
  }
}

/// Aluno sai do ranking (para de contar e de ver a turma).
export async function DELETE() {
  if (!featureEnabled("GAMIFICACAO")) return Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
  try {
    await leaveClassRanking(await aluno());
    return new Response(null, { status: 204 });
  } catch (error) {
    return rankingErrorResponse(error);
  }
}
