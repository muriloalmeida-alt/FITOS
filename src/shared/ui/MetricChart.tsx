"use client";

import { useState } from "react";
import styles from "./MetricChart.module.css";

export interface MetricPoint {
  /// ISO da data do registro.
  date: string;
  value: number;
}

interface MetricChartProps {
  points: MetricPoint[];
  /// Ex.: "kg", "%", "cm".
  unit: string;
  /// Nome da métrica, para leitor de tela e tabela ("Peso").
  label: string;
}

const WIDTH = 340;
const HEIGHT = 168;
const PAD_X = 24;
const PAD_TOP = 30;
const PAD_BOTTOM = 26;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

function fmt(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR");
}

/// Gráfico de linha da evolução (FIT-171/FIT-154): rótulos no primeiro e no
/// último ponto, dica ao tocar em um ponto e a tabela de dados acessível
/// ("Ver os dados"). Sem biblioteca de gráficos.
export function MetricChart({ points, unit, label }: MetricChartProps) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? WIDTH / 2 : PAD_X + (index / (points.length - 1)) * (WIDTH - PAD_X * 2),
    y: PAD_TOP + (1 - (point.value - min) / range) * (HEIGHT - PAD_TOP - PAD_BOTTOM),
  }));
  const line = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const summary = `${label}: de ${fmt(first.value)} ${unit} em ${dateFmt.format(new Date(first.date))} para ${fmt(last.value)} ${unit} em ${dateFmt.format(new Date(last.date))}`;
  const labeled = new Set([0, points.length - 1, ...(active !== null ? [active] : [])]);

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg} role="img" aria-label={summary}>
        <defs>
          <linearGradient id={`metric-area-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 ? (
          <>
            <polygon points={`${coords[0]!.x},${HEIGHT - PAD_BOTTOM} ${line} ${coords[coords.length - 1]!.x},${HEIGHT - PAD_BOTTOM}`} fill={`url(#metric-area-${label})`} />
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}
        {coords.map((coord, index) => (
          <g key={points[index]!.date}>
            <circle cx={coord.x} cy={coord.y} r={active === index ? 7 : 5} fill={active === index ? "var(--fitos-orange-500)" : "currentColor"} />
            {labeled.has(index) ? (
              <text x={coord.x} y={coord.y - 12} textAnchor={index === 0 && points.length > 1 ? "start" : index === points.length - 1 && points.length > 1 ? "end" : "middle"} className={styles.valueLabel}>
                {fmt(points[index]!.value)}
              </text>
            ) : null}
          </g>
        ))}
        <text x={coords[0]!.x} y={HEIGHT - 6} textAnchor={points.length > 1 ? "start" : "middle"} className={styles.axisLabel}>
          {dateFmt.format(new Date(first.date))}
        </text>
        {points.length > 1 ? (
          <text x={coords[coords.length - 1]!.x} y={HEIGHT - 6} textAnchor="end" className={styles.axisLabel}>
            {dateFmt.format(new Date(last.date))}
          </text>
        ) : null}
      </svg>
      {/* Alvos de toque sobre os pontos (a dica mostra valor e data). */}
      <div className={styles.hits}>
        {coords.map((coord, index) => (
          <button
            key={points[index]!.date}
            type="button"
            className={styles.hit}
            style={{ left: `${(coord.x / WIDTH) * 100}%`, top: `${(coord.y / HEIGHT) * 100}%` }}
            aria-label={`${fmt(points[index]!.value)} ${unit} em ${dateFmt.format(new Date(points[index]!.date))}`}
            onClick={() => setActive(active === index ? null : index)}
          />
        ))}
      </div>
      {active !== null ? (
        <figcaption className={styles.tip} role="status">
          {fmt(points[active]!.value)} {unit} · {dateFmt.format(new Date(points[active]!.date))}
        </figcaption>
      ) : null}
      <details className={styles.details}>
        <summary>Ver os dados</summary>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{label}, do mais antigo ao mais recente</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">{label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <td>{dateFmt.format(new Date(point.date))}</td>
                <td>
                  {fmt(point.value)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
