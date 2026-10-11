import { joinFriendGroup } from "@/modules/gamification/friendGroups";
import { jsonBody, withFriendSelf } from "@/modules/gamification/friendGroupsHttp";

/// Entra num grupo pelo código do convite.
export async function POST(request: Request) {
  return withFriendSelf(async (self) => Response.json(await joinFriendGroup(self, (await jsonBody(request)).code)));
}
