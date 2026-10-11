"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import type { CoachProgressionSuggestion } from "@/modules/execution/progression";
import styles from "./CoachProgression.module.css";

const KEY = "fitos:progressao-personal:manter";
const br = (value: number) => String(value).replace(".", ",");
const keyOf = (s: CoachProgressionSuggestion) => `${s.studentId}:${s.itemId}:${s.fromKg}`;

function dismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/// "Subir a carga?" para o personal (EPIC-44): o aluno fez todas as
/// repetições com a mesma carga nas duas últimas vezes, sem achar pesado.
/// Subir gera uma nova versão da cópia (com Desfazer) e avisa o aluno;
/// Manter não pergunta de novo para a mesma carga neste aparelho.
export function CoachProgressionList({ suggestions, showStudent = true }: { suggestions: CoachProgressionSuggestion[]; showStudent?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o armazenamento do navegador após a hidratação
    setHidden(dismissed());
  }, []);
  const visible = suggestions.filter((s) => !hidden.includes(keyOf(s)));
  if (visible.length === 0) return null;

  function keep(s: CoachProgressionSuggestion) {
    const next = [...hidden, keyOf(s)];
    setHidden(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next.slice(-200)));
    } catch {
      // Só nesta visita.
    }
  }

  async function raise(s: CoachProgressionSuggestion) {
    setBusy(keyOf(s));
    const response = await fetch(`/api/students/${s.studentId}/progressao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: s.itemId, toKg: s.toKg }) }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      toast.show("Não foi possível subir agora. Tente de novo.");
      return;
    }
    const { previousPlanId } = (await response.json()) as { previousPlanId: string };
    toast.show(`${s.exerciseName}: ${br(s.toKg)} kg para ${s.studentName.split(/\s+/)[0]}`, {
      label: "Desfazer",
      onClick: () =>
        void fetch(`/api/students/${s.studentId}/copia/restaurar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: previousPlanId }) }).then(() => router.refresh()),
    });
    router.refresh();
  }

  return (
    <section className={styles.section} aria-label="Subir a carga">
      <p className={styles.eyebrow}>Progressão</p>
      <ul className={styles.list}>
        {visible.map((s) => (
          <li key={keyOf(s)} className={styles.item}>
            <p className={styles.title}>
              {showStudent ? `${s.studentName.split(/\s+/)[0]} · ` : ""}
              {s.exerciseName}: {br(s.fromKg)} → {br(s.toKg)} kg
            </p>
            <p className={styles.muted}>
              {s.workoutName} · {s.reps} repetições em todas as séries nas duas últimas vezes, sem achar pesado.
            </p>
            <div className={styles.actions}>
              <Button type="button" disabled={busy !== null} onClick={() => void raise(s)}>
                {busy === keyOf(s) ? "Subindo…" : "Subir"}
              </Button>
              <Button type="button" variant="quiet" disabled={busy !== null} onClick={() => keep(s)}>
                Manter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
