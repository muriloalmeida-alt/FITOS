import styles from "./WeeklyRhythm.module.css";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface WeeklyRhythmBarProps {
  completedDays: number;
  targetDays: number;
  label: string;
}

/// Barra "X de Y dias" (telas 09/10, pacote visual 2026) — sempre a partir
/// de `getWeeklyRhythmForStudent` (sessões CONCLUIDA reais desta semana),
/// nunca um número do print. Usada quando existe uma meta real (`targetDays`
/// vindo do plano atribuído do aluno) — o workspace individual, sem esse
/// conceito, usa `WeeklyRhythmDots` abaixo em vez desta barra.
export function WeeklyRhythmBar({ completedDays, targetDays, label }: WeeklyRhythmBarProps) {
  const percent = targetDays > 0 ? Math.min(100, Math.round((completedDays / targetDays) * 100)) : 0;
  return (
    <div className={styles.barTrack} role="progressbar" aria-valuenow={completedDays} aria-valuemin={0} aria-valuemax={targetDays} aria-label={label}>
      <div className={styles.barFill} style={{ width: `${percent}%` }} />
      <span className={styles.barText} aria-hidden="true">
        {completedDays} / {targetDays} dias
      </span>
    </div>
  );
}

interface WeeklyRhythmDotsProps {
  dayFlags: boolean[];
}

/// Sete pontos (segunda a domingo, telas 09/10) marcando os dias reais com
/// sessão concluída nesta semana — sem meta/fração, usado pelo workspace
/// individual (FitOS Livre), que não tem plano atribuído.
export function WeeklyRhythmDots({ dayFlags }: WeeklyRhythmDotsProps) {
  return (
    <div className={styles.dotsRow} role="list" aria-label="Dias com treino concluído nesta semana">
      {DAY_LABELS.map((label, index) => (
        <div key={label} className={styles.dotColumn} role="listitem">
          <span className={styles.dotLabel}>{label}</span>
          <span
            className={dayFlags[index] ? `${styles.dot} ${styles.dotFilled}` : styles.dot}
            aria-label={dayFlags[index] ? `${label}: treino concluído` : `${label}: sem treino`}
          />
        </div>
      ))}
    </div>
  );
}
