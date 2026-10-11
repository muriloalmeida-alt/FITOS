import { requireSession } from "@/modules/tenancy/authContext";
import { contestRoute } from "@/modules/gamification/contestsHttp";
import { decideContest } from "@/modules/gamification/scoreContests";

/// Decisão do revisor do caso (organizador do grupo ou personal da turma).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return contestRoute(async () => {
    const ctx = await requireSession();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    return Response.json(await decideContest({ userId: ctx.userId }, (await params).id, body.outcome, body.decision));
  });
}
