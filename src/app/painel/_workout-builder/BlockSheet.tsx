"use client";

import { useState } from "react";
import { Button, ChipGroup, Sheet, Stepper } from "@/shared/ui";
import { BLOCK_HELP, BLOCK_KINDS, BLOCK_LABEL, type BlockKind, type WorkoutBlock } from "@/shared/lib/workoutBlocks";
import styles from "./BlockSheet.module.css";

function newKey(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/// Montar ou editar um bloco (Funcional e CrossFit): formato e só os
/// números que o definem. Os tempos são metas, não medição.
export function BlockSheet({ initial, onClose, onSave, onRemove }: { initial: WorkoutBlock | null; onClose: () => void; onSave: (block: WorkoutBlock) => void; onRemove?: () => void }) {
  const [kind, setKind] = useState<BlockKind>(initial?.kind ?? "CIRCUITO");
  const [name, setName] = useState(initial?.name ?? "");
  const [rounds, setRounds] = useState(initial?.rounds ?? (initial?.kind === "FOR_TIME" ? 0 : 3));
  const [rest, setRest] = useState(initial?.restSeconds ?? 0);
  const [windowMin, setWindowMin] = useState(Math.round((initial?.windowSeconds ?? 600) / 60));
  const [intervals, setIntervals] = useState(initial?.intervals ?? 10);
  const [intervalSeconds, setIntervalSeconds] = useState(initial?.intervalSeconds ?? 60);
  const [capMin, setCapMin] = useState(Math.round((initial?.timeCapSeconds ?? 0) / 60));

  function save() {
    const base = { key: initial?.key ?? newKey(), kind, name: name.trim() || null, rounds: null, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: null, restSeconds: null };
    const block: WorkoutBlock =
      kind === "CIRCUITO" ? { ...base, rounds: Math.max(1, rounds), restSeconds: rest || null }
      : kind === "AMRAP" ? { ...base, windowSeconds: windowMin * 60 }
      : kind === "EMOM" ? { ...base, intervals, intervalSeconds }
      : { ...base, rounds: rounds || null, timeCapSeconds: capMin ? capMin * 60 : null };
    onSave(block);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? "Editar bloco" : "Novo bloco"}
      footer={
        <>
          <Button type="button" block onClick={save}>
            {initial ? "Salvar bloco" : "Adicionar bloco"}
          </Button>
          {onRemove ? (
            <Button type="button" variant="quiet" block onClick={onRemove}>
              Remover bloco
            </Button>
          ) : null}
        </>
      }
    >
      <div className={styles.form}>
        <ChipGroup label="Formato" showLabel tone="accent" value={kind} onChange={(value) => setKind(value as BlockKind)} options={BLOCK_KINDS.map((value) => ({ value, label: BLOCK_LABEL[value] }))} />
        <p className={styles.help}>{BLOCK_HELP[kind]}</p>
        <label className={styles.field}>
          <span>Nome (opcional)</span>
          <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Aquecimento, WOD, Finalização" />
        </label>
        {kind === "CIRCUITO" ? (
          <>
            <Stepper label="Voltas" value={Math.max(1, rounds)} step={1} min={1} max={50} onChange={setRounds} />
            <Stepper label="Descanso entre voltas" value={rest} step={15} min={0} max={300} format={(v) => (v ? `${v} s` : "Sem")} onChange={setRest} />
          </>
        ) : null}
        {kind === "AMRAP" ? <Stepper label="Janela" value={windowMin} step={1} min={1} max={60} format={(v) => `${v} min`} onChange={setWindowMin} /> : null}
        {kind === "EMOM" ? (
          <>
            <Stepper label="Intervalos" value={intervals} step={1} min={1} max={60} onChange={setIntervals} />
            <Stepper label="Cada intervalo" value={intervalSeconds} step={15} min={30} max={300} format={(v) => (v % 60 === 0 ? `${v / 60} min` : `${v} s`)} onChange={setIntervalSeconds} />
          </>
        ) : null}
        {kind === "FOR_TIME" ? (
          <>
            <Stepper label="Rounds" value={rounds} step={1} min={0} max={50} format={(v) => (v ? String(v) : "1 (sequência)")} onChange={setRounds} />
            <Stepper label="Limite de tempo" value={capMin} step={1} min={0} max={90} format={(v) => (v ? `${v} min` : "Sem limite")} onChange={setCapMin} />
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
