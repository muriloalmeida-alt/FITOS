import styles from "./WeekStrip.module.css";

export type WeekStripDayState = "rest" | "planned" | "done" | "missed";

export interface WeekStripDay {
  /// Rótulo curto visível (ex.: "S", "T").
  short: string;
  /// Nome completo para leitores de tela (ex.: "Segunda").
  name: string;
  state: WeekStripDayState;
  today?: boolean;
}

const STATE_TEXT: Record<WeekStripDayState, string> = {
  rest: "descanso",
  planned: "treino previsto",
  done: "treino feito",
  missed: "treino não feito",
};

/// Faixa da semana (FIT-171): dias com treino previsto, feito ou descanso,
/// e o dia de hoje destacado. Estado nunca só por cor: cada dia tem nome
/// acessível com o estado por extenso, e o feito mostra "✓".
export function WeekStrip({ days, label = "Semana" }: { days: WeekStripDay[]; label?: string }) {
  return (
    <ol className={styles.strip} aria-label={label}>
      {days.map((day) => {
        const classes = [styles.day, styles[day.state], day.today ? styles.today : null].filter(Boolean).join(" ");
        return (
          <li key={day.name} className={classes} aria-label={`${day.name}${day.today ? " (hoje)" : ""}: ${STATE_TEXT[day.state]}`}>
            <span aria-hidden="true">{day.state === "done" ? "✓" : day.short}</span>
          </li>
        );
      })}
    </ol>
  );
}
