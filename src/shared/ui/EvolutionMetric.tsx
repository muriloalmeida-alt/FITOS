import styles from "./EvolutionMetric.module.css";

export type EvolutionMetricTrendDirection = "up" | "down" | "neutral";

interface EvolutionMetricTrend {
  label: string;
  direction: EvolutionMetricTrendDirection;
}

interface EvolutionMetricProps {
  value: string;
  label: string;
  trend?: EvolutionMetricTrend;
}

const TREND_SYMBOL: Record<EvolutionMetricTrendDirection, string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

/// Métrica de evolução (docs/03-experience/UX-ARCHITECTURE.md — "Início" do
/// Personal, "Progresso" do aluno): número grande + rótulo, com um chip de
/// tendência opcional. O símbolo de tendência (`↑`/`↓`/`→`) nunca é só cor —
/// já é texto, lido por qualquer leitor de tela.
export function EvolutionMetric({ value, label, trend }: EvolutionMetricProps) {
  return (
    <div className={styles.metric}>
      <strong className={styles.value}>{value}</strong>
      <span className={styles.label}>{label}</span>
      {trend ? (
        <span className={`${styles.trend} ${styles[trend.direction]}`}>
          <span aria-hidden="true">{TREND_SYMBOL[trend.direction]}</span> {trend.label}
        </span>
      ) : null}
    </div>
  );
}
