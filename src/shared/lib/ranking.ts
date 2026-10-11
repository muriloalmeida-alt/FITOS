/// Ranking da turma (Desafios, ADR-019), regra pura. Modo equilibrado:
/// cada treino vale a média dos itens previstos (`balancedTenths`). Por
/// semana (segunda a domingo, Brasília) contam os 3 melhores treinos, no
/// máximo 1 por dia; o mês soma as semanas. Empates dividem a posição.

import { periodOf, type Period } from "./medals";

export const BEST_PER_WEEK = 3;
const OFFSET_MS = -3 * 3_600_000;

export interface RankingEntry {
  studentId: string;
  performedAt: Date;
  balancedTenths: number;
  contested: boolean;
}

export interface RankingRow {
  studentId: string;
  position: number;
  pointsTenths: number;
  /// Treinos que entraram na conta.
  counted: number;
  /// Algum treino da conta está em contestação.
  contested: boolean;
}

function localDay(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/// Treinos que contam para um aluno no período.
export function countedEntries(entries: RankingEntry[]): RankingEntry[] {
  // 1 por dia: o melhor do dia.
  const bestByDay = new Map<string, RankingEntry>();
  for (const entry of entries) {
    const day = localDay(entry.performedAt);
    const current = bestByDay.get(day);
    if (!current || entry.balancedTenths > current.balancedTenths) bestByDay.set(day, entry);
  }
  // 3 melhores por semana.
  const byWeek = new Map<string, RankingEntry[]>();
  for (const entry of bestByDay.values()) {
    const key = periodOf("SEMANA", entry.performedAt).key;
    byWeek.set(key, [...(byWeek.get(key) ?? []), entry]);
  }
  return [...byWeek.values()].flatMap((week) => [...week].sort((a, b) => b.balancedTenths - a.balancedTenths).slice(0, BEST_PER_WEEK));
}

/// Classificação de quem participa (participantes sem treino entram com zero).
export function rankStudents(participants: string[], entries: RankingEntry[], period: Period): RankingRow[] {
  const inPeriod = entries.filter((entry) => entry.performedAt >= period.start && entry.performedAt < period.end);
  const rows = participants.map((studentId) => {
    const counted = countedEntries(inPeriod.filter((entry) => entry.studentId === studentId));
    return {
      studentId,
      pointsTenths: counted.reduce((sum, entry) => sum + entry.balancedTenths, 0),
      counted: counted.length,
      contested: counted.some((entry) => entry.contested),
    };
  });
  rows.sort((a, b) => b.pointsTenths - a.pointsTenths);
  let position = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.pointsTenths !== rows[index - 1]!.pointsTenths) position = index + 1;
    return { ...row, position };
  });
}
