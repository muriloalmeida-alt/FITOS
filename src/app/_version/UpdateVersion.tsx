"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";
import { INSTALLED_VERSION, fetchLiveVersion, forceUpdate } from "./forceUpdate";
import styles from "./UpdateVersion.module.css";

const TAPS_TO_REVEAL = 5;

/// "Atualizar versão" escondido: no rodapé aparece só a versão; cinco
/// toques mostram o botão, com a versão no aparelho e a no ar. Em
/// `/atualizar` (link do suporte) já abre revelado.
export function UpdateVersion({ revealed = false }: { revealed?: boolean }) {
  const [taps, setTaps] = useState(0);
  const [live, setLive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = revealed || taps >= TAPS_TO_REVEAL;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchLiveVersion().then((version) => {
      if (active) setLive(version);
    });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) {
    return (
      <button type="button" className={styles.version} onClick={() => setTaps((count) => count + 1)}>
        Versão {INSTALLED_VERSION}
      </button>
    );
  }

  const outdated = live !== null && live !== INSTALLED_VERSION;
  return (
    <section className={styles.panel} aria-label="Atualizar versão">
      <p className={styles.line}>
        No aparelho: <strong>{INSTALLED_VERSION}</strong>
        {" · "}No ar: <strong>{live ?? "…"}</strong>
      </p>
      <p className={styles.hint}>{outdated ? "Há uma versão mais nova. Atualize para ver as novidades." : "Recarrega o app do zero, sem cache. Seu login e o treino em andamento continuam."}</p>
      <Button
        type="button"
        block
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void forceUpdate();
        }}
      >
        {busy ? "Atualizando…" : "Atualizar versão"}
      </Button>
    </section>
  );
}
