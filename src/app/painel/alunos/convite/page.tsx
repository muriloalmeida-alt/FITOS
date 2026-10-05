import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AppShell, Avatar, ActionRow } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getOrCreateInviteCode } from "@/modules/students/inviteLink";
import { prisma } from "@/shared/db/prisma";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { InviteLinkCard } from "./InviteLinkCard";
import styles from "./page.module.css";

export const metadata: Metadata = { title: `Convidar aluno — ${appName}` };

const RECENT_DAYS = 14;

/// Convidar sem digitar nada (EPIC-29): o link do espaço para mandar no
/// WhatsApp ou mostrar em QR code. O aluno preenche os próprios dados.
export default async function InviteLinkPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const code = await getOrCreateInviteCode(ctx.tenantId);
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/c/${code}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#101c2c", light: "#ffffff" } });
  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS);
  const arrived = await prisma.student.findMany({
    where: { tenantId: ctx.tenantId, status: "ATIVO", userId: { not: null }, invitations: { some: { status: "ACEITO", acceptedAt: { gte: since } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, displayName: true, planAssignments: { where: { active: true }, select: { id: true }, take: 1 } },
  });

  return (
    <AppShell eyebrow="Novo aluno" title="Mande o link" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <InviteLinkCard url={url} qrSvg={qrSvg} />
      {arrived.length > 0 ? (
        <section className={styles.section} aria-labelledby="chegaram">
          <h2 id="chegaram" className={styles.title}>
            Chegaram pelo link
          </h2>
          <ul className={styles.list}>
            {arrived.map((student) => (
              <li key={student.id}>
                <ActionRow
                  leading={<Avatar name={student.displayName} />}
                  title={student.displayName}
                  description={student.planAssignments.length > 0 ? "Com programa" : "Sem programa"}
                  action={student.planAssignments.length > 0 ? { label: "Ver treino", href: `/painel/alunos/${student.id}/treino` } : { label: "Escolher programa", href: `/painel/treinos?aluno=${student.id}` }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
