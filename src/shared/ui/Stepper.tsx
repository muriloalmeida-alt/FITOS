"use client";

import styles from "./Stepper.module.css";

interface StepperProps {
  /// Rótulo visível acima do controle (ex.: "Séries", "Carga").
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /// Texto mostrado no lugar do número (ex.: 40 → "40 kg", 0 → "Livre").
  format?: (value: number) => string;
  /// "md" (44 px) para listas; "lg" (64 px) para a execução de treino.
  size?: "md" | "lg";
  /// Rótulo visível escondido, mantendo o nome acessível (para grades
  /// compactas que já mostram o rótulo em outro lugar).
  hideLabel?: boolean;
  disabled?: boolean;
}

function roundToStep(value: number) {
  return Math.round(value * 100) / 100;
}

/// Controle −/+ (FIT-171, EPIC-23): substitui campos numéricos digitados
/// (séries, repetições, carga, descanso, peso, dia de vencimento). Os dois
/// botões têm alvo ≥ 44 px (≥ 64 px no tamanho "lg") e nome acessível com
/// o rótulo; o valor atual é anunciado por `aria-live`.
export function Stepper({ label, value, onChange, step = 1, min = 0, max = Number.MAX_SAFE_INTEGER, format, size = "md", hideLabel = false, disabled = false }: StepperProps) {
  const display = format ? format(value) : String(value).replace(".", ",");
  const canDecrement = !disabled && value - step >= min - 1e-9;
  const canIncrement = !disabled && value + step <= max + 1e-9;

  return (
    <div className={size === "lg" ? `${styles.stepper} ${styles.lg}` : styles.stepper}>
      <span className={hideLabel ? styles.srOnly : styles.label}>{label}</span>
      <div className={styles.control} role="group" aria-label={label}>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(roundToStep(Math.max(min, value - step)))}
          disabled={!canDecrement}
          aria-label={`Diminuir ${label.toLowerCase()}`}
        >
          −
        </button>
        <output className={styles.value} aria-live="polite">
          {display}
        </output>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(roundToStep(Math.min(max, value + step)))}
          disabled={!canIncrement}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
