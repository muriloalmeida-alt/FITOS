import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell, type AppShellNavItem } from "@/shared/ui";
import { goalProgress, type PanelDay, type PanelGoal } from "@/shared/lib/panel";
import { LogoutButton } from "../LogoutButton";
import { StartWorkout, type StartChoices } from "./StartWorkout";
import styles from "./StudentPanel.module.css";

interface StudentPanelProps {
  firstName: string;
  dateLabel?: string;
  message: string;
  week: { days: PanelDay[]; rangeLabel: string; todayLabel: string };
  evolution: { week: PanelGoal; month: PanelGoal; href: string };
  start: StartChoices;
  startOpen?: boolean;
  navItems: AppShellNavItem[];
  /// Um aviso por vez (pagamento, ficha de saúde, teste grátis…), depois
  /// da evolução: o Início cabe na tela sem rolagem.
  notices?: ReactNode;
}

function Goal({ label, goal }: { label: string; goal: PanelGoal }) {
  const progress = goalProgress(goal);
  return (
    <div className={styles.goal}>
      <span className={styles.goalLabel}>{label}</span>
      <strong className={styles.goalValue}>
        {progress ? `${goal.done} de ${goal.goal} treinos` : `${goal.done} ${goal.done === 1 ? "treino" : "treinos"}`}
      </strong>
      {progress ? (
        <>
          <span className={styles.bar} role="progressbar" aria-label={`${label}: progresso da meta`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.bar}>
            <span style={{ width: `${progress.bar}%` }} />
          </span>
          <span className={styles.goalMeta}>{progress.percent}% da meta</span>
        </>
      ) : (
        <span className={styles.goalMeta}>Meta não definida</span>
      )}
    </div>
  );
}

/// Painel inicial do aluno (proposta 9, aprovada em 11/10/2026): data,
/// "Olá, [primeiro nome]!", mensagem, Sua semana, Iniciar treino e Sua
/// evolução, nesta ordem, em blocos integrados ao fundo.
export function StudentPanel({ firstName, dateLabel, message, week, evolution, start, startOpen = false, navItems, notices }: StudentPanelProps) {
  return (
    <AppShell eyebrow={dateLabel} title={`Olá, ${firstName}!`} subtitle={message} headerMode="mobile" navItems={navItems} activeKey="hoje" trailing={<LogoutButton />} compact>
      <section className={styles.block} aria-labelledby="sua-semana">
        <div className={styles.head}>
          <h2 id="sua-semana" className={styles.title}>
            Sua semana
          </h2>
          <span className={styles.muted}>{week.rangeLabel}</span>
        </div>
        <ol className={styles.week} aria-label={`Sua semana, ${week.rangeLabel}`}>
          {week.days.map((day) => (
            <li
              key={day.key}
              className={[styles.day, day.done ? styles.done : null, day.today ? styles.today : null, day.planned && !day.done ? styles.planned : null].filter(Boolean).join(" ")}
              aria-label={`${day.name}, dia ${day.date}${day.today ? " (hoje)" : ""}: ${day.done ? "treino realizado" : day.planned ? "treino previsto" : "sem treino"}`}
            >
              <span className={styles.dayName} aria-hidden="true">
                {day.short}
              </span>
              <span className={styles.dayMark} aria-hidden="true">
                {day.done ? "✓" : day.date}
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.legend}>
          <span aria-hidden="true">✓</span> Treino realizado · {week.todayLabel}
        </p>
      </section>

      <StartWorkout choices={start} initialOpen={startOpen} />

      <section className={styles.block} aria-labelledby="sua-evolucao">
        <div className={styles.head}>
          <h2 id="sua-evolucao" className={styles.title}>
            Sua evolução
          </h2>
          <Link href={evolution.href} className={styles.link} aria-label="Ver minha evolução">
            Ver tudo <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className={styles.goals}>
          <Goal label="Nesta semana" goal={evolution.week} />
          <Goal label="Neste mês" goal={evolution.month} />
        </div>
      </section>

      {notices}
    </AppShell>
  );
}
