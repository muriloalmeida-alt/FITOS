import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { FriendGroupError, getFriendGroup } from "@/modules/gamification/friendGroups";
import { LogoutButton } from "../../../LogoutButton";
import { selfForPage } from "../../../selfPage";
import { FriendGroupView } from "../../FriendGroupView";

export const metadata: Metadata = {
  title: `Grupo de amigos — ${appName}`,
};

/// Um grupo de amigos (Desafios 4/4): só para quem é membro.
export default async function FriendGroupPage({ params }: { params: Promise<{ id: string }> }) {
  if (!featureEnabled("GAMIFICACAO")) notFound();
  const self = await selfForPage();
  let group;
  try {
    group = await getFriendGroup(self, (await params).id);
  } catch (error) {
    if (error instanceof FriendGroupError) notFound();
    throw error;
  }
  const season = group.season ? { ...group.season, startsAt: group.season.startsAt.toISOString(), endsAt: group.season.endsAt.toISOString() } : null;
  return (
    <AppShell eyebrow="Desafios · Amigos" title={group.name} navItems={self.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <FriendGroupView group={{ ...group, season }} nowIso={new Date().toISOString()} />
    </AppShell>
  );
}
