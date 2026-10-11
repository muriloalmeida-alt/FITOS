import { startFriendSeason } from "@/modules/gamification/friendGroups";
import { jsonBody, withFriendSelf } from "@/modules/gamification/friendGroupsHttp";

/// Nova temporada (7, 14 ou 28 dias): só o organizador, sem outra em andamento.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withFriendSelf(async (self) => {
    const season = await startFriendSeason(self, (await params).id, (await jsonBody(request)).lengthDays);
    return Response.json({ startsAt: season.startsAt, endsAt: season.endsAt }, { status: 201 });
  });
}
