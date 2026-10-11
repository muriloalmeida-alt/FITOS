import { createFriendGroup } from "@/modules/gamification/friendGroups";
import { jsonBody, withFriendSelf } from "@/modules/gamification/friendGroupsHttp";

/// Cria um grupo de amigos (nome, modo, duração da temporada); quem cria organiza.
export async function POST(request: Request) {
  return withFriendSelf(async (self) => {
    const body = await jsonBody(request);
    const group = await createFriendGroup(self, { name: body.name, mode: body.mode, lengthDays: body.lengthDays });
    return Response.json({ groupId: group.id, inviteCode: group.inviteCode }, { status: 201 });
  });
}
