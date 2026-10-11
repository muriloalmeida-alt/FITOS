"use client";

import { useState } from "react";
import { MetricChart } from "@/shared/ui";
import type { EvolutionMetricKey, EvolutionSeries, MeasureChange } from "@/modules/evolution/evolutionSeries";
import styles from "./EvolutionView.module.css";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });

function fmt(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR");
}

function signed(delta: number, unit: string) {
  if (delta === 0) return `sem mudança`;
  return `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))} ${unit}`;
}

/// Evolução do corpo (FIT-154 Aluno, FIT-159 Livre): métrica em chips,
/// valor atual e variação, gráfico de linha e medidas da primeira para a
/// última avaliação.
export function EvolutionView({ series, measures }: { series: EvolutionSeries[]; measures: MeasureChange[] }) {
  const [key, setKey] = useState<EvolutionMetricKey>(series[0]?.key ?? "peso");
  const current = series.find((entry) => entry.key === key) ?? series[0];
  if (!current) return null;
  const first = current.points[0]!;
  const last = current.points[current.points.length - 1]!;

  return (
    <div className={styles.view}>
      <div className={styles.chips} role="tablist" aria-label="Métrica">
        {series.map((entry) => (
          <button key={entry.key} type="button" role="tab" aria-selected={entry.key === current.key} className={entry.key === current.key ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setKey(entry.key)}>
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.headline}>
        <span className={styles.value}>
          {fmt(last.value)}
          <small> {current.unit}</small>
        </span>
        <span className={styles.delta}>{current.points.length > 1 ? `${signed(last.value - first.value, current.unit)} desde ${dateFmt.format(new Date(first.date))}` : `em ${dateFmt.format(new Date(last.date))}`}</span>
      </div>
      <MetricChart key={current.key} points={current.points} unit={current.unit} label={current.label} />

      {measures.length > 0 ? (
        <section aria-labelledby="medidas" className={styles.section}>
          <h2 id="medidas" className={styles.title}>
            Medidas
          </h2>
          <ul className={styles.measures}>
            {measures.map((measure) => (
              <li key={measure.type}>
                <span>{measure.label}</span>
                <span className={styles.muted}>
                  {fmt(measure.first)} → <strong>{fmt(measure.last)} cm</strong>
                </span>
                <span className={measure.delta < 0 ? styles.down : measure.delta > 0 ? styles.up : styles.muted}>{signed(measure.delta, "cm")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
