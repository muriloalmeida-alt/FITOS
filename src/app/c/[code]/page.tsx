import type { Metadata } from "next";
import { Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getInviteLink } from "@/modules/students/inviteLink";
import { EntradaShell } from "../../_entrada/EntradaShell";
import styles from "../../_entrada/Entrada.module.css";
import { JoinByLinkForm } from "./JoinByLinkForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Convite — ${appName}` };

/// Entrar no espaço do personal pelo link (EPIC-29/33): quem convidou, a
/// conta, o objetivo e o treino de hoje.
export default async function JoinByLinkPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams?: Promise<{ ref?: string }> }) {
  const { code } = await params;
  // EPIC-47: link compartilhado por um aluno (`?ref=<id do aluno>`).
  const ref = (await searchParams)?.ref;
  const referrerId = typeof ref === "string" && /^[a-z0-9]{10,40}$/.test(ref) ? ref : null;
  const link = await getInviteLink(code);
  if (!link) {
    return (
      <EntradaShell>
        <div>
          <h1 className={styles.title}>Link inválido</h1>
          <p className={styles.lead}>Peça um link novo ao seu personal.</p>
        </div>
        <Button href="/entrar" variant="secondary" block>
          Já tenho conta
        </Button>
      </EntradaShell>
    );
  }
  const first = link.personalName.trim().split(/\s+/)[0] ?? link.personalName;
  const initials = link.personalName
    .trim()
    .split(/\s+/)
    .filter((part, index, all) => index === 0 || index === all.length - 1)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <EntradaShell>
      <div className={styles.account}>
        <span className={styles.accountIni} aria-hidden="true">
          {initials}
        </span>
        <div>
          <p className={styles.cardTitle}>{link.personalName} te convidou</p>
          <p className={styles.muted}>{[link.businessName, link.cref ? `CREF ${link.cref}` : null].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <JoinByLinkForm code={code} personalFirstName={first} businessName={link.businessName} referrerId={referrerId} />
    </EntradaShell>
  );
}
