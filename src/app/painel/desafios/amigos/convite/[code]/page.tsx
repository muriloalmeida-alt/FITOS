import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { previewInvite } from "@/modules/gamification/friendGroups";
import { LogoutButton } from "../../../../LogoutButton";
import { selfForPage } from "../../../../selfPage";
import { JoinFriendGroup } from "./JoinFriendGroup";

export const metadata: Metadata = {
  title: `Convite para grupo — ${appName}`,
};

/// Convite de Amigos: mostra o grupo, o modo e as regras antes de entrar.
export default async function FriendInvitePage({ params }: { params: Promise<{ code: string }> }) {
  if (!featureEnabled("GAMIFICACAO")) notFound();
  const self = await selfForPage();
  const { code } = await params;
  const preview = await previewInvite(decodeURIComponent(code));
  return (
    <AppShell eyebrow="Desafios · Amigos" title={preview ? preview.name : "Convite não encontrado"} navItems={self.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <JoinFriendGroup
        code={decodeURIComponent(code)}
        preview={preview ? { mode: preview.mode, members: preview.members, season: preview.season ? { lengthDays: preview.season.lengthDays, endsAt: preview.season.endsAt.toISOString() } : null } : null}
        nowIso={new Date().toISOString()}
      />
    </AppShell>
  );
}
