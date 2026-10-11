import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { contestRoute } from "@/modules/gamification/contestsHttp";
import { openContest } from "@/modules/gamification/scoreContests";

/// Contesta um treino de outra pessoa no grupo de amigos ou na turma.
export async function POST(request: Request) {
  return contestRoute(async () => {
    const self = await requireSelfStudent();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    const target = body.context === "TURMA" ? { context: "TURMA" as const } : { context: "AMIGOS" as const, groupId: String(body.groupId ?? "") };
    const contest = await openContest({ userId: self.userId, tenantId: self.tenantId, studentId: self.studentId }, target, String(body.scoreId ?? ""), body.reason);
    return Response.json({ contestId: contest.id }, { status: 201 });
  });
}
