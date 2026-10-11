/// Datas e horas da agenda (EPIC-48), sempre no horário de Brasília
/// (UTC−3, sem horário de verão desde 2019). Datas como "AAAA-MM-DD".

const OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

export function localDate(instant: Date): string {
  return new Date(instant.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export function localMinutes(instant: Date): number {
  const local = new Date(instant.getTime() - OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/// 0 = domingo … 6 = sábado.
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && addDays(value, 0) === value;
}

/// Instante (UTC) de um dia e hora locais.
export function toInstant(date: string, minutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + minutes * 60_000 + OFFSET_MS);
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function weekdayLabel(day: number, short = false): string {
  return (short ? SHORT : WEEKDAYS)[day] ?? "";
}

/// "qui, 8/out".
export function dayLabel(date: string): string {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "");
  return `${SHORT[weekdayOf(date)]}, ${Number(date.slice(8, 10))}/${month}`;
}
