"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import styles from "./InviteLinkCard.module.css";

/// Link do espaço com WhatsApp, Copiar e QR code (EPIC-29). "Gerar link
/// novo" invalida o anterior.
export function InviteLinkCard({ url, qrSvg }: { url: string; qrSvg: string }) {
  const router = useRouter();
  const toast = useToast();
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const message = `Oi! Entra no meu FitOS por aqui para receber seus treinos: ${url}`;

  async function copy() {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast.show("Link copiado");
  }

  async function regenerate() {
    setBusy(true);
    const response = await fetch("/api/students/convite-link", { method: "POST" });
    setBusy(false);
    if (response.ok) {
      toast.show("Link novo gerado. O anterior não funciona mais.");
      router.refresh();
    }
  }

  return (
    <section className={styles.card} aria-label="Seu link de convite">
      <p className={styles.url}>{url.replace(/^https?:\/\//, "")}</p>
      <div className={styles.share}>
        <Button href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" block>
          WhatsApp
        </Button>
        <Button type="button" variant="secondary" block onClick={() => void copy()}>
          Copiar
        </Button>
        <Button type="button" variant="secondary" block aria-pressed={showQr} onClick={() => setShowQr((current) => !current)}>
          QR code
        </Button>
      </div>
      {showQr ? (
        <figure className={styles.qr}>
          <span className={styles.qrImage} role="img" aria-label="QR code do link de convite" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <figcaption className={styles.muted}>O aluno aponta a câmera e entra.</figcaption>
        </figure>
      ) : null}
      <Button type="button" variant="quiet" block disabled={busy} onClick={() => void regenerate()}>
        Gerar link novo
      </Button>
      <Button href="/painel/alunos?novo=1" variant="quiet" block>
        Prefiro cadastrar o aluno eu mesmo
      </Button>
    </section>
  );
}
