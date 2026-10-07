"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, Sheet, useToast } from "@/shared/ui";
import { FOCUS_MUSCLES, FOCUS_REGIONS, normalizeFocus, type Focus } from "@/shared/lib/workoutFocus";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./FreeWorkoutButton.module.css";

/// Treino avulso (FitOS Livre): começa sem treino montado; antes, o
/// praticante escolhe o que quer treinar (regiões e grupos musculares) e
/// os exercícios são escolhidos durante a execução.
export function FreeWorkoutButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Focus[]>([]);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await requestJson("/api/minhas-sessoes/avulso", { method: "POST", body: JSON.stringify({ focus: normalizeFocus(focus) }) });
      router.push("/painel/meus-treinos/sessao");
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível começar.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.button} onClick={() => setOpen(true)}>
        <span className={styles.icon} aria-hidden="true">
          ⚡
        </span>
        <span className={styles.text}>
          <strong>Treino avulso</strong>
          <span>Pouco tempo ou academia cheia? Escolha cada exercício na hora.</span>
        </span>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="O que você quer treinar hoje?"
        description="Escolha um ou mais. A biblioteca abre no seu foco e a avaliação no fim considera o que você escolheu."
        footer={
          <Button type="button" block size="lg" disabled={focus.length === 0 || busy} onClick={() => void start()}>
            {busy ? "Começando…" : focus.length === 0 ? "Escolha o foco" : "Começar treino avulso"}
          </Button>
        }
      >
        <div className={styles.groups}>
          <ChipGroup<Focus> label="Regiões" showLabel multiple value={focus} onChange={setFocus} options={FOCUS_REGIONS.map((value) => ({ value, label: value }))} />
          <ChipGroup<Focus> label="Grupos musculares" showLabel multiple value={focus} onChange={setFocus} options={FOCUS_MUSCLES.map((value) => ({ value, label: value }))} />
        </div>
      </Sheet>
    </>
  );
}
