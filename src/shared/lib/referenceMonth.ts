/// Competência financeira ("AAAA-MM", formato do `<input type="month">`)
/// sempre como o primeiro dia do mês em UTC (FIT-050, FIT-148).

export function parseReferenceMonth(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})(?:-01)?$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

export function currentReferenceMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function referenceMonthKey(referenceMonth: Date): string {
  return `${referenceMonth.getUTCFullYear()}-${String(referenceMonth.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftReferenceMonth(referenceMonth: Date, months: number): Date {
  return new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() + months, 1));
}

/// "Outubro de 2026".
export function referenceMonthLabel(referenceMonth: Date): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(referenceMonth);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
