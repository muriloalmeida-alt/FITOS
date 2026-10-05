"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Ruler, useToast } from "@/shared/ui";
import styles from "./AssessmentRuler.module.css";

export interface LastAssessment {
  dateLabel: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

type Extra = "fat" | "waist" | "hip";

const EXTRAS: { key: Extra; label: string }[] = [
  { key: "fat", label: "% gordura" },
  { key: "waist", label: "Cintura" },
  { key: "hip", label: "Quadril" },
];

function diff(now: number, before: number | null, unit: string) {
  if (before === null) return null;
  const delta = Math.round((now - before) * 10) / 10;
  if (delta === 0) return "igual à última";
  return `${delta > 0 ? "+" : "−"}${String(Math.abs(delta)).replace(".", ",")} ${unit} desde a última`;
}

/// Avaliação na régua (EPIC-29): o peso começa no último valor; gordura,
/// cintura e quadril só entram se o personal tocar neles.
export function AssessmentRuler({ studentId, firstName, last }: { studentId: string; firstName: string; last: LastAssessment | null }) {
  const router = useRouter();
  const toast = useToast();
  const [weight, setWeight] = useState(last?.weightKg ?? 70);
  const [fat, setFat] = useState(last?.bodyFatPercent ?? 20);
  const [waist, setWaist] = useState(last?.waistCm ?? 80);
  const [hip, setHip] = useState(last?.hipCm ?? 95);
  const [on, setOn] = useState<Record<Extra, boolean>>({ fat: false, waist: false, hip: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weightDiff = diff(weight, last?.weightKg ?? null, "kg");

  async function save() {
    setBusy(true);
    setError(null);
    const measurements = [
      ...(on.waist ? [{ type: "CINTURA", valueCm: waist }] : []),
      ...(on.hip ? [{ type: "QUADRIL", valueCm: hip }] : []),
    ];
    const response = await fetch(`/api/students/${studentId}/avaliacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: weight, bodyFatPercent: on.fat ? fat : null, measurements }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Não foi possível salvar. Tente de novo.");
      return;
    }
    toast.show(`Avaliação de ${firstName} salva`);
    router.push(`/painel/alunos/${studentId}`);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      {last ? <p className={styles.muted}>Última em {last.dateLabel}. Ajuste só o que mudou.</p> : null}
      <Ruler label="Peso" unit="kg" value={weight} onChange={setWeight} min={30} max={200} step={0.1} />
      {weightDiff ? <p className={styles.diff}>{weightDiff}</p> : null}

      <div className={styles.chips} role="group" aria-label="Também medir">
        {EXTRAS.map((extra) => (
          <button key={extra.key} type="button" className={on[extra.key] ? `${styles.chip} ${styles.chipOn}` : styles.chip} aria-pressed={on[extra.key]} onClick={() => setOn((current) => ({ ...current, [extra.key]: !current[extra.key] }))}>
            {on[extra.key] ? "✓ " : "+ "}
            {extra.label}
          </button>
        ))}
      </div>

      {on.fat ? <Ruler label="Gordura" unit="%" value={fat} onChange={setFat} min={3} max={60} step={0.5} majorEvery={10} /> : null}
      {on.waist ? <Ruler label="Cintura" unit="cm" value={waist} onChange={setWaist} min={40} max={180} step={0.5} majorEvery={10} /> : null}
      {on.hip ? <Ruler label="Quadril" unit="cm" value={hip} onChange={setHip} min={50} max={200} step={0.5} majorEvery={10} /> : null}

      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" block disabled={busy} onClick={() => void save()}>
        Salvar avaliação
      </Button>
    </div>
  );
}
