"use client";

import { cardioPhases, CARDIO_INTENSITY_LABELS, type CardioIntensity } from "@/shared/lib/cardio";
import styles from "./CardioRunner.module.css";

export interface CardioPosition {
  index: number;
  left: number;
  elapsed: number;
  total: number;
}

/// Em que etapa o aeróbico está, dado o tempo decorrido em segundos.
export function cardioPosition(durationSeconds: number, intensity: CardioIntensity, elapsedSeconds: number): CardioPosition {
  const phases = cardioPhases(durationSeconds, intensity);
  const total = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  let start = 0;
  for (const [index, phase] of phases.entries()) {
    if (elapsedSeconds < start + phase.seconds) return { index, left: start + phase.seconds - elapsedSeconds, elapsed: elapsedSeconds, total };
    start += phase.seconds;
  }
  return { index: phases.length, left: 0, elapsed: Math.min(elapsedSeconds, total), total };
}

function mmss(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

interface Props {
  durationSeconds: number;
  intensity: CardioIntensity;
  elapsedSeconds: number;
  running: boolean;
  onToggle: () => void;
  onSkipPhase: () => void;
}

/// Aeróbico ao vivo (EPIC-28): etapas com contagem regressiva, a dica de
/// cada uma e a lista do que vem. Tiros fortes em laranja.
export function CardioRunner({ durationSeconds, intensity, elapsedSeconds, running, onToggle, onSkipPhase }: Props) {
  const phases = cardioPhases(durationSeconds, intensity);
  const position = cardioPosition(durationSeconds, intensity, elapsedSeconds);
  const finished = position.index >= phases.length;
  const phase = phases[Math.min(position.index, phases.length - 1)]!;
  const percent = finished ? 100 : Math.round(100 * (1 - position.left / phase.seconds));

  return (
    <section className={styles.runner} aria-label="Aeróbico">
      <div className={phase.kind === "hard" && !finished ? `${styles.panel} ${styles.hard}` : styles.panel}>
        <p className={styles.phase}>{finished ? "Tempo cumprido" : phase.label}</p>
        <p className={styles.clock} role="timer" aria-live="off">
          {finished ? mmss(position.total) : mmss(position.left)}
        </p>
        <p className={styles.cue}>{finished ? "Toque em Aeróbico feito." : phase.cue}</p>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onToggle} disabled={finished}>
            {running ? "Pausar" : elapsedSeconds > 0 ? "Continuar" : "Começar"}
          </button>
          <button type="button" className={styles.secondary} onClick={onSkipPhase} disabled={finished}>
            Próxima etapa
          </button>
        </div>
        <p className={styles.total}>
          {CARDIO_INTENSITY_LABELS[intensity]} · {mmss(Math.max(0, position.total - position.elapsed))} no total
        </p>
      </div>
      <ol className={styles.list} aria-label="Etapas">
        {phases.map((entry, index) => (
          <li key={`${entry.label}-${index}`} className={index < position.index ? styles.done : index === position.index ? styles.now : undefined}>
            <span className={entry.kind === "hard" ? `${styles.num} ${styles.numHard}` : styles.num}>{index + 1}</span>
            <span>{entry.label}</span>
            <span className={styles.time}>{mmss(entry.seconds)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
