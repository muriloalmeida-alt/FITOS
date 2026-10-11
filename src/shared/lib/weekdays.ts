import type { WeekStripDay, WeekStripDayState } from "@/shared/ui/WeekStrip";

/// Dias da semana como persistidos em `Workout.suggestedDays` (FIT-030),
/// na ordem segunda → domingo usada em todas as telas.
export const WEEKDAYS = [
  { key: "SEGUNDA", short: "Seg", letter: "S", name: "Segunda" },
  { key: "TERCA", short: "Ter", letter: "T", name: "Terça" },
  { key: "QUARTA", short: "Qua", letter: "Q", name: "Quarta" },
  { key: "QUINTA", short: "Qui", letter: "Q", name: "Quinta" },
  { key: "SEXTA", short: "Sex", letter: "S", name: "Sexta" },
  { key: "SABADO", short: "Sáb", letter: "S", name: "Sábado" },
  { key: "DOMINGO", short: "Dom", letter: "D", name: "Domingo" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

/// "Seg, Qui" na ordem da semana; "sem dia definido" quando vazio.
export function formatDays(days: readonly string[]): string {
  const labels = WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.short);
  return labels.length > 0 ? labels.join(", ") : "sem dia definido";
}

/// Índice segunda=0 … domingo=6 de uma data.
export function mondayFirstIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

/// Faixa da semana a partir dos dias previstos (e, opcionalmente, dos dias
/// já treinados e do dia de hoje).
export function weekStripFromDays(planned: readonly string[], options: { done?: readonly boolean[]; today?: Date } = {}): WeekStripDay[] {
  const todayIndex = options.today ? mondayFirstIndex(options.today) : -1;
  return WEEKDAYS.map((day, index) => {
    let state: WeekStripDayState = planned.includes(day.key) ? "planned" : "rest";
    if (options.done?.[index]) state = "done";
    return { short: day.letter, name: day.name, state, today: index === todayIndex };
  });
}
