import { WEEKDAYS } from "./weekdays";
import { periodOf, plannedDays } from "./medals";

/// Painel do aluno (proposta 9): regras puras da semana e da evolução,
/// no fuso do produto (America/Sao_Paulo), semana de segunda a domingo.

const OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;
const SHORT = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;
const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."] as const;

export interface PanelDay {
  key: string;
  /// "SEG".
  short: string;
  /// "Segunda".
  name: string;
  /// Dia do mês.
  date: number;
  done: boolean;
  today: boolean;
  planned: boolean;
}

const local = (instant: Date) => new Date(instant.getTime() + OFFSET_MS);

/// Os sete dias da semana de `now`, com feitos (pela data de realização)
/// e previstos.
export function panelWeek(now: Date, performed: Date[], plannedKeys: readonly string[]): { days: PanelDay[]; rangeLabel: string } {
  const week = periodOf("SEMANA", now);
  const todayIndex = Math.floor((now.getTime() - week.start.getTime()) / DAY_MS);
  const done = new Set(performed.filter((date) => date >= week.start && date < week.end).map((date) => Math.floor((date.getTime() - week.start.getTime()) / DAY_MS)));
  const days = WEEKDAYS.map((day, index) => ({
    key: day.key,
    short: SHORT[index]!,
    name: day.name,
    date: local(new Date(week.start.getTime() + index * DAY_MS)).getUTCDate(),
    done: done.has(index),
    today: index === todayIndex,
    planned: plannedKeys.includes(day.key),
  }));
  const first = local(week.start);
  const last = local(new Date(week.end.getTime() - 1));
  const rangeLabel = first.getUTCMonth() === last.getUTCMonth() ? `${first.getUTCDate()} - ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}` : `${first.getUTCDate()} ${MONTHS[first.getUTCMonth()]} - ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}`;
  return { days, rangeLabel };
}

export interface PanelGoal {
  done: number;
  /// `null`: sem meta configurada.
  goal: number | null;
}

/// Treinos concluídos na semana e no mês de `now` (pela data de realização,
/// uma vez por sessão) contra a meta: os dias de treino configurados
/// contados no período. Sem dias configurados, nada é suposto: a semana
/// usa a frequência já escolhida (se houver) e o mês fica sem meta.
export function panelGoals(now: Date, performed: Date[], goalDays: readonly string[], weeklyFallback: number | null = null): { week: PanelGoal; month: PanelGoal } {
  const week = periodOf("SEMANA", now);
  const month = periodOf("MES", now);
  const count = (period: { start: Date; end: Date }) => performed.filter((date) => date >= period.start && date < period.end).length;
  const hasDays = goalDays.length > 0;
  return {
    week: { done: count(week), goal: hasDays ? plannedDays(week, goalDays) : weeklyFallback && weeklyFallback > 0 ? weeklyFallback : null },
    month: { done: count(month), goal: hasDays ? plannedDays(month, goalDays) : null },
  };
}

/// Percentual arredondado (pode passar de 100) e barra limitada a 100.
/// Sem meta (ou meta zero), `null`: nunca divide por zero.
export function goalProgress(goal: PanelGoal): { percent: number; bar: number } | null {
  if (!goal.goal || goal.goal <= 0) return null;
  const percent = Math.round((goal.done / goal.goal) * 100);
  return { percent, bar: Math.min(100, percent) };
}
