import type { Metadata } from "next";
import { Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getInviteLink } from "@/modules/students/inviteLink";
import { EntradaShell } from "../../_entrada/EntradaShell";
import styles from "../../_entrada/Entrada.module.css";
import { JoinByLinkForm } from "./JoinByLinkForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Convite — ${appName}` };

/// Entrar no espaço do personal pelo link (EPIC-29): nome, e-mail e senha,
/// e o aluno já cai no Início.
export default async function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
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
  return (
    <EntradaShell>
      <div>
        <p className={styles.eyebrow}>{link.businessName}</p>
        <h1 className={styles.title}>Treinar com {first}</h1>
      </div>
      <JoinByLinkForm code={code} />
    </EntradaShell>
  );
}
