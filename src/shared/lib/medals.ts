/// FitOS Desafios (feature 3, ADR-019): metas e medalhas, regras puras.
/// Semana de segunda a domingo e mês do calendário, no horário de
/// Brasília. Meta = 10 pontos × exercícios previstos no período; faixas
/// proporcionais à meta congelada. Uma medalha por período, com upgrade.

import { WEEKDAYS } from "./weekdays";

export type PeriodType = "SEMANA" | "MES";

export interface Period {
  type: PeriodType;
  /// Início (inclusivo) e fim (exclusivo), instantes UTC.
  start: Date;
  end: Date;
  /// "2026-10-05" (segunda da semana) ou "2026-10".
  key: string;
}

const OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;

/// Meia-noite de Brasília do dia local que contém `instant`.
function localMidnight(instant: Date): Date {
  const local = new Date(instant.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET_MS);
}

export function periodOf(type: PeriodType, instant: Date): Period {
  const local = new Date(instant.getTime() + OFFSET_MS);
  if (type === "MES") {
    const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS);
    const end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - OFFSET_MS);
    return { type, start, end, key: `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}` };
  }
  const mondayIndex = (local.getUTCDay() + 6) % 7;
  const start = new Date(localMidnight(instant).getTime() - mondayIndex * DAY_MS);
  return { type, start, end: new Date(start.getTime() + 7 * DAY_MS), key: new Date(start.getTime() + OFFSET_MS).toISOString().slice(0, 10) };
}

/// Período anterior (para a galeria).
export function previousPeriod(period: Period): Period {
  return periodOf(period.type, new Date(period.start.getTime() - 1));
}

/// Dias de treino previstos no período pelos "meus dias" do aluno; sem
/// dias definidos, 3 por semana.
export function plannedDays(period: Period, preferredDays: readonly string[]): number {
  const keys = WEEKDAYS.map((day) => day.key);
  const chosen = new Set(preferredDays.filter((day) => (keys as readonly string[]).includes(day)));
  const days = Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS);
  if (chosen.size === 0) return Math.round((days * 3) / 7);
  let count = 0;
  for (let index = 0; index < days; index++) {
    const local = new Date(period.start.getTime() + index * DAY_MS + OFFSET_MS);
    if (chosen.has(keys[(local.getUTCDay() + 6) % 7]!)) count += 1;
  }
  return count;
}

export const DEFAULT_ITEMS_PER_WORKOUT = 5;

/// Meta em décimos: 10 pontos × dias previstos × exercícios por treino.
export function goalTenths(days: number, itemsPerWorkout: number): number {
  return Math.max(0, days) * Math.max(1, itemsPerWorkout) * 100;
}

export type Medal = "BRONZE" | "PRATA" | "OURO" | "PLATINA";

export const MEDALS: { medal: Medal; label: string; title: string; percent: number }[] = [
  { medal: "BRONZE", label: "Bronze", title: "Em movimento", percent: 50 },
  { medal: "PRATA", label: "Prata", title: "Ritmo firme", percent: 75 },
  { medal: "OURO", label: "Ouro", title: "Missão cumprida", percent: 100 },
  { medal: "PLATINA", label: "Platina", title: "Evolução", percent: 110 },
];

/// Limiar de uma faixa em décimos (arredonda para cima: 50% de 175 = 87,5 → 88).
export function thresholdTenths(goal: number, percent: number): number {
  return Math.ceil((goal * percent) / 100 / 10) * 10;
}

export function medalFor(pointsTenths: number, goal: number): Medal | null {
  if (goal <= 0) return null;
  let current: Medal | null = null;
  for (const band of MEDALS) if (pointsTenths >= thresholdTenths(goal, band.percent)) current = band.medal;
  return current;
}

/// Próxima faixa e quanto falta ("135/180 pontos · faltam 45 para Ouro").
export function nextMedal(pointsTenths: number, goal: number): { medal: Medal; label: string; missingTenths: number; thresholdTenths: number } | null {
  if (goal <= 0) return null;
  for (const band of MEDALS) {
    const threshold = thresholdTenths(goal, band.percent);
    if (pointsTenths < threshold) return { medal: band.medal, label: band.label, missingTenths: threshold - pointsTenths, thresholdTenths: threshold };
  }
  return null;
}
