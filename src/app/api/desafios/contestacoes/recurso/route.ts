import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { contestRoute } from "@/modules/gamification/contestsHttp";
import { appealContest } from "@/modules/gamification/scoreContests";

/// Recurso do autor contra a anulação do próprio treino.
export async function POST(request: Request) {
  return contestRoute(async () => {
    const self = await requireSelfStudent();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    const contest = await appealContest({ userId: self.userId, tenantId: self.tenantId, studentId: self.studentId }, String(body.scoreId ?? ""), body.reason);
    return Response.json({ contestId: contest.id }, { status: 201 });
  });
}
