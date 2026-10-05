"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Stepper, useToast } from "@/shared/ui";
import type { GoalSuggestion } from "@/modules/evolution/goalSuggestions";
import styles from "./GoalPicker.module.css";

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const HORIZONS = [2, 3, 6];

function br(value: number) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

export function goalText(suggestion: GoalSuggestion, value: number): string {
  switch (suggestion.key) {
    case "peso":
      return `Perder ${br(value)} kg`;
    case "frequencia":
      return `Treinar ${value}× por semana`;
    case "carga":
      return `${suggestion.exerciseName ?? "Carga"} com ${br(value)} kg`;
  }
}

/// Escolher a meta (EPIC-30): toca numa sugestão, ajusta o valor e o prazo.
export function GoalPicker({ suggestions, doneHref, todayIso }: { suggestions: GoalSuggestion[]; doneHref: string; todayIso: string }) {
  const router = useRouter();
  const toast = useToast();
  const today = new Date(todayIso);
  const ends = HORIZONS.map((months) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months + 1, 0)));
  const [picked, setPicked] = useState<GoalSuggestion["key"] | null>(null);
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(suggestions.map((s) => [s.key, s.value])));
  const [end, setEnd] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = monthFmt.format(ends[end]!);
  const current = suggestions.find((s) => s.key === picked) ?? null;

  async function save() {
    if (!current) return;
    setBusy(true);
    setError(null);
    const description = `${goalText(current, values[current.key]!)} até ${until}`;
    const response = await fetch("/api/minha-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, targetDate: ends[end]!.toISOString() }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Não foi possível salvar. Tente de novo.");
      return;
    }
    toast.show("Meta salva");
    router.push(doneHref);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.options} role="radiogroup" aria-label="Metas sugeridas">
        {suggestions.map((suggestion) => {
          const on = picked === suggestion.key;
          return (
            <button key={suggestion.key} type="button" role="radio" aria-checked={on} className={on ? `${styles.option} ${styles.on}` : styles.option} onClick={() => setPicked(suggestion.key)}>
              <span className={styles.title}>
                {goalText(suggestion, values[suggestion.key]!)} até {until}
              </span>
              <span className={styles.why}>{suggestion.why}</span>
            </button>
          );
        })}
      </div>

      {current ? (
        <div className={styles.adjust}>
          <Stepper
            label="Ajustar"
            value={values[current.key]!}
            step={current.step}
            min={current.min}
            max={current.unit === "x" ? 7 : 500}
            format={(value) => (current.unit === "x" ? `${value}× / semana` : `${br(value)} kg`)}
            onChange={(value) => setValues((all) => ({ ...all, [current.key]: value }))}
          />
          <div className={styles.chips} role="radiogroup" aria-label="Até">
            {ends.map((date, index) => (
              <button key={date.toISOString()} type="button" role="radio" aria-checked={end === index} className={end === index ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setEnd(index)}>
                {monthFmt.format(date)}
              </button>
            ))}
          </div>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button type="button" block disabled={busy} onClick={() => void save()}>
            Salvar meta
          </Button>
        </div>
      ) : null}
    </div>
  );
}
