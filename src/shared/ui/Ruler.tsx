"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import styles from "./Ruler.module.css";

interface RulerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /// Unidade mostrada ao lado do número (ex.: "kg", "cm", "%").
  unit: string;
  /// Um número a cada `majorEvery` marcas (ex.: 10 marcas de 0,1 = 1 kg).
  majorEvery?: number;
}

const TICK = 10;

function round(value: number, step: number) {
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 1 : 0;
  return Number(value.toFixed(decimals));
}

function format(value: number, step: number) {
  return (step < 1 ? value.toFixed(String(step).split(".")[1]?.length ?? 1) : String(value)).replace(".", ",");
}

/// Régua (EPIC-29): arrastar para o lado ajusta o valor, sem teclado. O
/// número grande mostra o valor; setas do teclado e os botões −/+ ajustam
/// um passo. Marcas desenhadas no fundo (sem um elemento por marca).
export function Ruler({ label, value, onChange, min, max, step, unit, majorEvery = 10 }: RulerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ticks = Math.round((max - min) / step);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.round((value - min) / step) * TICK;
    if (Math.abs(track.scrollLeft - target) >= TICK / 2) track.scrollLeft = target;
  }, [value, min, step]);

  function set(next: number) {
    const clamped = Math.min(max, Math.max(min, round(next, step)));
    if (clamped !== value) onChange(clamped);
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    set(min + Math.round(track.scrollLeft / TICK) * step);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      set(value + step);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      set(value - step);
    }
  }

  const majors: number[] = [];
  for (let index = 0; index <= ticks; index += majorEvery) majors.push(index);

  return (
    <div className={styles.ruler}>
      <span className={styles.label}>{label}</span>
      <div className={styles.readout}>
        <button type="button" className={styles.nudge} onClick={() => set(value - step)} aria-label={`Diminuir ${label.toLowerCase()}`}>
          −
        </button>
        <output className={styles.value} aria-live="polite">
          {format(value, step)}
          <span className={styles.unit}>{unit}</span>
        </output>
        <button type="button" className={styles.nudge} onClick={() => set(value + step)} aria-label={`Aumentar ${label.toLowerCase()}`}>
          +
        </button>
      </div>
      <div className={styles.frame}>
        <div
          ref={trackRef}
          className={styles.track}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${format(value, step)} ${unit}`}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
        >
          <div className={styles.scale} style={{ width: ticks * TICK + 1, ["--major" as string]: `${majorEvery * TICK}px` }}>
            {majors.map((index) => (
              <span key={index} className={styles.number} style={{ left: index * TICK }}>
                {format(round(min + index * step, step), 1)}
              </span>
            ))}
          </div>
        </div>
        <span className={styles.needle} aria-hidden="true" />
      </div>
    </div>
  );
}
