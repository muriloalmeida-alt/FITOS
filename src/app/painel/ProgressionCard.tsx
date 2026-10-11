"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import type { ProgressionSuggestion } from "@/modules/execution/progression";
import { formatLoadForStorage } from "@/shared/lib/load";
import styles from "./IndividualHome.module.css";

const KEY = "fitos:progressao:manter";

function br(value: number) {
  return String(value).replace(".", ",");
}

function dismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/// "Subir a carga?" (EPIC-30): uma sugestão por vez, resolvida no lugar.
/// "Manter" não pergunta de novo para a mesma carga neste aparelho.
export function ProgressionCard({ suggestions }: { suggestions: ProgressionSuggestion[] }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o armazenamento do navegador após a hidratação
    setHidden(dismissed());
  }, []);
  const key = (s: ProgressionSuggestion) => `${s.itemId}:${s.fromKg}`;
  const current = suggestions.find((s) => !hidden.includes(key(s)));
  if (!current) return null;

  function keep() {
    const next = [...hidden, key(current!)];
    setHidden(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // Só nesta visita.
    }
  }

  async function raise() {
    setBusy(true);
    const response = await fetch(`/api/meus-treinos/${current!.workoutId}/itens/${current!.itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ load: formatLoadForStorage(current!.toKg) }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      toast.show("Não foi possível subir agora. Tente de novo.");
      return;
    }
    toast.show(`${current!.exerciseName}: ${br(current!.toKg)} kg a partir de hoje`, {
      label: "Desfazer",
      onClick: () =>
        void fetch(`/api/meus-treinos/${current!.workoutId}/itens/${current!.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ load: formatLoadForStorage(current!.fromKg) }),
        }).then(() => router.refresh()),
    });
    router.refresh();
  }

  return (
    <section className={styles.ask} aria-label="Progressão">
      <p className={styles.eyebrow}>Progressão</p>
      <p className={styles.askTitle}>
        Subir {current.exerciseName.toLowerCase()} para {br(current.toKg)} kg?
      </p>
      <p className={styles.muted}>
        Nas duas últimas vezes você fez {current.reps} repetições em todas as séries com {br(current.fromKg)} kg, sem achar pesado.
      </p>
      <div className={styles.askActions}>
        <Button type="button" block disabled={busy} onClick={() => void raise()}>
          Subir
        </Button>
        <Button type="button" variant="secondary" block onClick={keep}>
          Manter
        </Button>
      </div>
    </section>
  );
}
