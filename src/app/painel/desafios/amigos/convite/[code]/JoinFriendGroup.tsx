"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import { FRIEND_RULES, MODE_HELP, MODE_LABEL, seasonLabel } from "../../../friendTexts";
import styles from "../../../FriendGroups.module.css";

interface Props {
  code: string;
  preview: { mode: "TOTAL" | "EQUILIBRADO"; members: number; season: { lengthDays: number; endsAt: string } | null } | null;
  nowIso: string;
}

/// Antes de entrar: modo de pontuação, temporada e regras (participação voluntária).
export function JoinFriendGroup({ code, preview, nowIso }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!preview) {
    return (
      <section className={styles.panel}>
        <p className={styles.muted}>Confira o código com quem te convidou.</p>
        <Link href="/painel/desafios?aba=amigos">Voltar para Amigos</Link>
      </section>
    );
  }

  async function join() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/desafios/amigos/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setError(body?.message ?? "Não foi possível entrar. Tente de novo.");
      return;
    }
    router.push(`/painel/desafios/amigos/${body.groupId}`);
  }

  return (
    <section className={styles.panel} aria-label="Convite">
      <p className={styles.muted}>
        {preview.members} {preview.members === 1 ? "pessoa" : "pessoas"} · {MODE_LABEL[preview.mode]}
      </p>
      <p className={styles.season}>{preview.season ? seasonLabel({ ...preview.season, startsAt: nowIso, running: true }, nowIso) : "Sem temporada em andamento"}</p>
      <p className={styles.muted}>{MODE_HELP[preview.mode]}</p>
      <ul className={styles.rules}>
        {FRIEND_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" size="lg" block disabled={busy} onClick={() => void join()}>
        {busy ? "Entrando…" : "Entrar no grupo"}
      </Button>
    </section>
  );
}
