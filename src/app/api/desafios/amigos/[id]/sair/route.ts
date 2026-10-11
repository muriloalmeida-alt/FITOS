import { leaveFriendGroup } from "@/modules/gamification/friendGroups";
import { withFriendSelf } from "@/modules/gamification/friendGroupsHttp";

/// Sai do grupo: para de contar e perde a leitura.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withFriendSelf(async (self) => {
    await leaveFriendGroup(self, (await params).id);
    return new Response(null, { status: 204 });
  });
}
