import { MODALITIES, offerable, type Modality } from "./modalities";

/// Recomendação de programas prontos por modalidade (proposta 11). Pura.
/// Só entra conteúdo classificado com todas as modalidades entre as
/// escolhidas; programas de várias modalidades só quando cadastrados assim
/// (nunca fundidos aqui). Dentro de cada grupo, os mais compatíveis com o
/// nível e a disponibilidade vêm primeiro.

export type Level = "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
export type Availability = "UM_A_DOIS_DIAS" | "TRES_A_QUATRO_DIAS" | "CINCO_OU_MAIS_DIAS";

export interface RecommendableProgram {
  key: string;
  name: string;
  modalities: string[];
  /// Nível declarado; `null` = sem nível cadastrado.
  level: Level | null;
  weeks: number | null;
  /// Dias por semana; `null` = não cadastrado.
  weeklyFrequency: number | null;
  minutes: { min: number; max: number } | null;
}

export interface RecommendationGroup<T extends RecommendableProgram> {
  /// Uma modalidade, ou várias quando o programa é misto (cadastrado assim).
  modalities: Modality[];
  programs: T[];
}

const LEVEL_RANK: Record<Level, number> = { INICIANTE: 0, INTERMEDIARIO: 1, AVANCADO: 2 };
const AVAILABILITY_DAYS: Record<Availability, [number, number]> = { UM_A_DOIS_DIAS: [1, 2], TRES_A_QUATRO_DIAS: [3, 4], CINCO_OU_MAIS_DIAS: [5, 7] };

/// Menor é melhor: nível igual primeiro (avançado aceita intermediário),
/// depois a frequência mais perto da disponibilidade.
export function compatibilityScore(program: RecommendableProgram, input: { level: Level; availability: Availability }): number {
  let score = 0;
  if (program.level === null) score += 2;
  else {
    const gap = LEVEL_RANK[program.level] - LEVEL_RANK[input.level];
    score += gap === 0 ? 0 : gap < 0 ? (input.level === "AVANCADO" && program.level === "INTERMEDIARIO" ? 1 : 3) : 6;
  }
  if (program.weeklyFrequency === null) score += 1;
  else {
    const [min, max] = AVAILABILITY_DAYS[input.availability];
    score += program.weeklyFrequency < min ? min - program.weeklyFrequency : program.weeklyFrequency > max ? 2 * (program.weeklyFrequency - max) : 0;
  }
  return score;
}

export function recommendPrograms<T extends RecommendableProgram>(programs: T[], input: { modalities: readonly Modality[]; level: Level; availability: Availability }): { groups: RecommendationGroup<T>[]; missing: Modality[] } {
  const chosen = MODALITIES.filter((modality) => input.modalities.includes(modality));
  const eligible = programs.filter((program) => offerable(program.modalities, chosen));
  const byKey = new Map<string, RecommendationGroup<T>>();
  for (const program of eligible) {
    const modalities = MODALITIES.filter((modality) => program.modalities.includes(modality));
    const key = modalities.join("+");
    const group = byKey.get(key) ?? { modalities, programs: [] };
    group.programs.push(program);
    byKey.set(key, group);
  }
  const order = (group: RecommendationGroup<T>) => (group.modalities.length > 1 ? 10 : MODALITIES.indexOf(group.modalities[0]!));
  const groups = [...byKey.values()].sort((a, b) => order(a) - order(b));
  for (const group of groups) {
    group.programs.sort((a, b) => compatibilityScore(a, input) - compatibilityScore(b, input) || a.name.localeCompare(b.name, "pt-BR"));
  }
  const covered = new Set(groups.flatMap((group) => group.modalities));
  return { groups, missing: chosen.filter((modality) => !covered.has(modality)) };
}
