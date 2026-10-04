import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  /// 0 a 100.
  value: number;
  label: string;
  /// Texto do valor para leitores de tela (ex.: "3 de 4 treinos").
  valueText?: string;
}

/// Barra de progresso (FIT-171): teste grátis, aderência da semana,
/// semana do programa.
export function ProgressBar({ value, label, valueText }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-valuetext={valueText}>
      <span className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
