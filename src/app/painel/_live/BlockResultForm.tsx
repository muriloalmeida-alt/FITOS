"use client";

import { ChipGroup, Stepper } from "@/shared/ui";
import type { WorkoutBlock } from "@/shared/lib/workoutBlocks";
import styles from "./BlockPanel.module.css";

export type BlockOutcomeChoice = "CONCLUIDO" | "LIMITE_ATINGIDO" | "PARCIAL";

export interface BlockResultDraft {
  outcome: BlockOutcomeChoice;
  rounds: number;
  partial: number;
  intervals: number;
  note: string;
  /// Retroativo: tempo do For Time concluído, declarado (sem timer).
  minutes: number;
  seconds: number;
}

export function emptyResultDraft(block: WorkoutBlock): BlockResultDraft {
  return { outcome: block.kind === "FOR_TIME" ? "CONCLUIDO" : "PARCIAL", rounds: 0, partial: 0, intervals: 0, note: "", minutes: 0, seconds: 0 };
}

/// Corpo do resultado para as rotas (ao vivo e retroativo).
export function resultPayload(block: WorkoutBlock, draft: BlockResultDraft, declareTime = false) {
  return {
    outcome: draft.outcome,
    roundsCompleted: block.kind === "EMOM" ? null : draft.rounds,
    partialReps: block.kind === "EMOM" || block.kind === "CIRCUITO" ? null : draft.partial || null,
    intervalsCompleted: block.kind === "EMOM" ? draft.intervals : null,
    note: draft.note,
    ...(declareTime ? { elapsedSeconds: block.kind === "FOR_TIME" && draft.outcome === "CONCLUIDO" ? draft.minutes * 60 + draft.seconds || null : null } : {}),
  };
}

/// Campos do resultado de um bloco: como terminou (For Time), voltas,
/// round parcial, intervalos e nota. `timerLabel` mostra o tempo medido
/// ao vivo; sem ele (`declareTime`), o For Time concluído pede o tempo.
export function BlockResultForm({ block, value, onChange, timerLabel, declareTime = false }: { block: WorkoutBlock; value: BlockResultDraft; onChange: (draft: BlockResultDraft) => void; timerLabel?: string; declareTime?: boolean }) {
  const set = (patch: Partial<BlockResultDraft>) => onChange({ ...value, ...patch });
  const finished = block.kind === "FOR_TIME" && value.outcome === "CONCLUIDO";
  return (
    <div className={styles.form}>
      {block.kind === "FOR_TIME" ? (
        <ChipGroup
          label="Como terminou"
          showLabel
          tone="accent"
          value={value.outcome}
          onChange={(outcome) => set({ outcome: outcome as BlockOutcomeChoice })}
          options={[
            { value: "CONCLUIDO", label: "Concluído" },
            ...(block.timeCapSeconds ? [{ value: "LIMITE_ATINGIDO", label: "Limite atingido" }] : []),
            { value: "PARCIAL", label: "Parei antes" },
          ]}
        />
      ) : null}
      {finished && timerLabel ? <p className={styles.muted}>Tempo do bloco: {timerLabel} (pelo timer).</p> : null}
      {finished && declareTime ? (
        <div className={styles.time2}>
          <Stepper label="Minutos" value={value.minutes} step={1} min={0} max={600} onChange={(minutes) => set({ minutes })} />
          <Stepper label="Segundos" value={value.seconds} step={5} min={0} max={55} onChange={(seconds) => set({ seconds })} />
        </div>
      ) : null}
      {block.kind === "EMOM" ? (
        <Stepper label="Intervalos concluídos" value={value.intervals} step={1} min={0} max={block.intervals ?? 60} onChange={(intervals) => set({ intervals })} />
      ) : (
        <Stepper label={block.kind === "CIRCUITO" ? "Voltas completas" : "Rounds completos"} value={value.rounds} step={1} min={0} max={500} onChange={(rounds) => set({ rounds })} />
      )}
      {block.kind === "AMRAP" || (block.kind === "FOR_TIME" && !finished) ? <Stepper label="Reps da volta incompleta" value={value.partial} step={1} min={0} max={500} onChange={(partial) => set({ partial })} /> : null}
      <label className={styles.field}>
        <span>Nota (opcional)</span>
        <input value={value.note} maxLength={300} onChange={(event) => set({ note: event.target.value })} placeholder="Ex.: escalei o pull-up" />
      </label>
    </div>
  );
}
