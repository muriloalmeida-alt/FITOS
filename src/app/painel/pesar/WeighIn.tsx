"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Ruler, useToast } from "@/shared/ui";
import styles from "./WeighIn.module.css";

interface WeighInProps {
  last: { weightKg: number; bodyFatPercent: number | null; dateLabel: string } | null;
  /// FitOS Livre também registra o % de gordura.
  allowFat: boolean;
  doneHref: string;
}

function br(value: number) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

/// Pesar na régua (EPIC-30): o peso de hoje em um gesto e um toque.
export function WeighIn({ last, allowFat, doneHref }: WeighInProps) {
  const router = useRouter();
  const toast = useToast();
  const [weight, setWeight] = useState(last?.weightKg ?? 70);
  const [withFat, setWithFat] = useState(false);
  const [fat, setFat] = useState(last?.bodyFatPercent ?? 20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delta = last ? Math.round((weight - last.weightKg) * 10) / 10 : null;

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/meu-peso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: weight, bodyFatPercent: allowFat && withFat ? fat : null }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Não foi possível salvar. Tente de novo.");
      return;
    }
    toast.show(`${br(weight)} kg salvo`);
    router.push(doneHref);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <Ruler label="Peso" unit="kg" value={weight} onChange={setWeight} min={30} max={200} step={0.1} />
      {delta !== null && last ? (
        <p className={delta < 0 ? `${styles.delta} ${styles.down}` : styles.delta}>
          {delta === 0 ? `Igual a ${last.dateLabel}` : `${delta > 0 ? "+" : "−"}${br(Math.abs(delta))} kg desde ${last.dateLabel}`}
        </p>
      ) : null}
      {allowFat ? (
        withFat ? (
          <Ruler label="Gordura" unit="%" value={fat} onChange={setFat} min={3} max={60} step={0.5} />
        ) : (
          <button type="button" className={styles.chip} onClick={() => setWithFat(true)}>
            + % de gordura
          </button>
        )
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" block disabled={busy} onClick={() => void save()}>
        Salvar {br(weight)} kg
      </Button>
    </div>
  );
}
