"use client";

import { useEffect, useState } from "react";
import { Button, ChipGroup, FormAlert, Sheet, Stepper } from "@/shared/ui";
import { blockElapsedSeconds, blockResultSummary, blockSummary, type WorkoutBlock } from "@/shared/lib/workoutBlocks";
import styles from "./BlockPanel.module.css";

export interface BlockResultView {
  blockKey: string;
  startedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
  endedAt: string | null;
  outcome: string | null;
  roundsCompleted: number | null;
  partialReps: number | null;
  intervalsCompleted: number | null;
  elapsedSeconds: number | null;
  note: string | null;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/// Bloco do exercício atual no treino ao vivo (Funcional e CrossFit): o
/// formato e a meta, o timer do bloco (iniciar, pausar, retomar; o
/// servidor guarda os instantes) e "Encerrar bloco" com o resultado real.
export function BlockPanel({ block, initial, endpoint, onChange }: { block: WorkoutBlock; initial: BlockResultView | null; endpoint: string; onChange?: (result: BlockResultView) => void }) {
  const [result, setResult] = useState<BlockResultView | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [outcome, setOutcome] = useState<"CONCLUIDO" | "LIMITE_ATINGIDO" | "PARCIAL">(block.kind === "FOR_TIME" ? "CONCLUIDO" : "PARCIAL");
  const [rounds, setRounds] = useState(initial?.roundsCompleted ?? 0);
  const [partial, setPartial] = useState(initial?.partialReps ?? 0);
  const [intervals, setIntervals] = useState(initial?.intervalsCompleted ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  const running = Boolean(result?.startedAt && !result.pausedAt && !result.endedAt);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsed = result ? blockElapsedSeconds(result, new Date(now)) : 0;
  const target = block.kind === "AMRAP" ? block.windowSeconds : block.kind === "EMOM" ? (block.intervals ?? 0) * (block.intervalSeconds ?? 60) : block.kind === "FOR_TIME" ? block.timeCapSeconds : null;
  const remaining = target ? Math.max(0, target - elapsed) : null;
  const emomInterval = block.kind === "EMOM" && result?.startedAt ? Math.min(block.intervals ?? 0, Math.floor(elapsed / (block.intervalSeconds ?? 60)) + 1) : null;

  async function send(method: "POST" | "PUT", url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível salvar. Tente de novo.");
      return null;
    }
    const saved = (await response.json()) as BlockResultView;
    setNow(Date.now());
    setResult(saved);
    onChange?.(saved);
    return saved;
  }

  /// A meta não vira "feito": no EMOM sugere os intervalos que o relógio
  /// já fechou; o resto começa do zero até o praticante informar.
  function openFinish() {
    if (block.kind === "EMOM" && !result?.endedAt) setIntervals(Math.min(block.intervals ?? 0, Math.floor(elapsed / (block.intervalSeconds ?? 60))));
    setFinishing(true);
  }

  async function finish() {
    const saved = await send("PUT", endpoint, { outcome, roundsCompleted: block.kind === "EMOM" ? null : rounds, partialReps: block.kind === "EMOM" || block.kind === "CIRCUITO" ? null : partial || null, intervalsCompleted: block.kind === "EMOM" ? intervals : null, note });
    if (saved) setFinishing(false);
  }

  return (
    <section className={styles.panel} aria-label={`Bloco ${blockSummary(block)}`}>
      <div className={styles.head}>
        <strong>{blockSummary(block)}</strong>
        {result?.endedAt ? <span className={styles.done}>{blockResultSummary(block, result)}</span> : null}
      </div>
      {!result?.endedAt ? (
        <>
          <div className={styles.timer} aria-live="polite">
            <span className={styles.time}>{clock(remaining ?? elapsed)}</span>
            <span className={styles.muted}>
              {remaining !== null ? (block.kind === "FOR_TIME" ? "até o limite" : "restantes") : "no bloco"}
              {emomInterval ? ` · intervalo ${emomInterval} de ${block.intervals}` : ""}
              {result?.pausedAt ? " · pausado" : ""}
            </span>
          </div>
          <div className={styles.actions}>
            {!result?.startedAt ? (
              <Button type="button" disabled={busy} onClick={() => void send("POST", `${endpoint}/timer`, { action: "INICIAR" })}>
                Iniciar bloco
              </Button>
            ) : result.pausedAt ? (
              <Button type="button" disabled={busy} onClick={() => void send("POST", `${endpoint}/timer`, { action: "RETOMAR" })}>
                Retomar
              </Button>
            ) : (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void send("POST", `${endpoint}/timer`, { action: "PAUSAR" })}>
                Pausar
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={busy} onClick={openFinish}>
              Encerrar bloco
            </Button>
          </div>
        </>
      ) : (
        <button type="button" className={styles.link} onClick={() => setFinishing(true)}>
          Corrigir resultado
        </button>
      )}
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      {finishing ? (
        <Sheet
          open
          onClose={() => setFinishing(false)}
          title="Resultado do bloco"
          description="Informe o que você realmente fez. A meta não conta como feito."
          footer={
            <Button type="button" block disabled={busy} onClick={() => void finish()}>
              {busy ? "Salvando…" : "Salvar resultado"}
            </Button>
          }
        >
          <div className={styles.form}>
            {block.kind === "FOR_TIME" ? (
              <ChipGroup
                label="Como terminou"
                showLabel
                tone="accent"
                value={outcome}
                onChange={(value) => setOutcome(value as typeof outcome)}
                options={[
                  { value: "CONCLUIDO", label: "Concluído" },
                  ...(block.timeCapSeconds ? [{ value: "LIMITE_ATINGIDO", label: "Limite atingido" }] : []),
                  { value: "PARCIAL", label: "Parei antes" },
                ]}
              />
            ) : null}
            {block.kind === "FOR_TIME" && outcome === "CONCLUIDO" ? <p className={styles.muted}>Tempo do bloco: {clock(elapsed)} (pelo timer).</p> : null}
            {block.kind === "EMOM" ? (
              <Stepper label="Intervalos concluídos" value={intervals} step={1} min={0} max={block.intervals ?? 60} onChange={setIntervals} />
            ) : (
              <Stepper label={block.kind === "CIRCUITO" ? "Voltas completas" : "Rounds completos"} value={rounds} step={1} min={0} max={500} onChange={setRounds} />
            )}
            {block.kind === "AMRAP" || (block.kind === "FOR_TIME" && outcome !== "CONCLUIDO") ? <Stepper label="Reps da volta incompleta" value={partial} step={1} min={0} max={500} onChange={setPartial} /> : null}
            <label className={styles.field}>
              <span>Nota (opcional)</span>
              <input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: escalei o pull-up" />
            </label>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
