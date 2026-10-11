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

/// Amigos (Desafios 4/4): grupos privados com temporada de 7, 14 ou 28 dias.
export const SEASON_LENGTHS = [7, 14, 28] as const;
export type SeasonLength = (typeof SEASON_LENGTHS)[number];
export type FriendMode = "TOTAL" | "EQUILIBRADO";

export function isSeasonLength(value: unknown): value is SeasonLength {
  return typeof value === "number" && (SEASON_LENGTHS as readonly number[]).includes(value);
}

export function seasonWindow(startsAt: Date, lengthDays: SeasonLength): { startsAt: Date; endsAt: Date } {
  return { startsAt, endsAt: new Date(startsAt.getTime() + lengthDays * 86_400_000) };
}

export interface SeasonMember {
  memberId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface SeasonEntry {
  memberId: string;
  performedAt: Date;
  totalTenths: number;
  balancedTenths: number;
  contested: boolean;
}

export interface SeasonRow {
  memberId: string;
  position: number;
  pointsTenths: number;
  counted: number;
  contested: boolean;
}

/// Classificação da temporada. Conta o treino feito dentro dela, depois da
/// entrada do membro e antes da saída. TOTAL soma os pontos; EQUILIBRADO
/// usa a média por treino com 1 por dia e os 3 melhores por semana.
export function rankSeason(mode: FriendMode, season: { startsAt: Date; endsAt: Date }, members: SeasonMember[], entries: SeasonEntry[]): SeasonRow[] {
  const rows = members.map((member) => {
    const from = Math.max(season.startsAt.getTime(), member.joinedAt.getTime());
    const until = Math.min(season.endsAt.getTime(), member.leftAt?.getTime() ?? Infinity);
    const mine = entries.filter((entry) => entry.memberId === member.memberId && entry.performedAt.getTime() >= from && entry.performedAt.getTime() < until);
    if (mode === "TOTAL") {
      return { memberId: member.memberId, pointsTenths: mine.reduce((sum, entry) => sum + entry.totalTenths, 0), counted: mine.length, contested: mine.some((entry) => entry.contested) };
    }
    const counted = countedEntries(mine.map((entry) => ({ studentId: entry.memberId, performedAt: entry.performedAt, balancedTenths: entry.balancedTenths, contested: entry.contested })));
    return { memberId: member.memberId, pointsTenths: counted.reduce((sum, entry) => sum + entry.balancedTenths, 0), counted: counted.length, contested: counted.some((entry) => entry.contested) };
  });
  rows.sort((a, b) => b.pointsTenths - a.pointsTenths);
  let position = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.pointsTenths !== rows[index - 1]!.pointsTenths) position = index + 1;
    return { ...row, position };
  });
}
