/// FitOS Desafios (feature 3): motor de pontuação, puro. Regras do PDF
/// "3-Gamificacao" e parâmetros definidos (ADR-019):
///
/// - Musculação: volume = Σ repetições × carga de cada série. Na referência,
///   10 pontos; acima, +1 por 10% inteiros; abaixo, proporcional com uma
///   casa decimal. Teto de 20 por exercício.
/// - Sem carga: o mesmo cálculo com repetições × séries no lugar do volume.
/// - Aeróbico: tempo do item. Na referência (padrão 30 min), 10; acima, +1
///   por bloco de 10 min inteiros; abaixo, proporcional. Teto de 15.
/// - Sem referência positiva: zero (nunca dividir por zero).
///
/// Pontos guardados em décimos (inteiro) para não acumular erro de ponto
/// flutuante: 10,5 pontos = 105.

export const RULE_VERSION = 1;
export const STRENGTH_CAP_TENTHS = 200;
export const CARDIO_CAP_TENTHS = 150;
export const DEFAULT_CARDIO_REFERENCE_SECONDS = 30 * 60;
const EPSILON = 1e-9;

/// Pontos (em décimos) de um item de musculação: `done` e `reference` na
/// mesma unidade (gramas·repetição com carga; repetições sem carga).
export function strengthPointsTenths(done: number, reference: number): number {
  if (!(reference > 0) || !(done > 0)) return 0;
  if (done + EPSILON >= reference) {
    const steps = Math.floor((done / reference - 1) * 10 + EPSILON);
    return Math.min(STRENGTH_CAP_TENTHS, (10 + steps) * 10);
  }
  return Math.round((100 * done) / reference);
}

/// Pontos (em décimos) de um item aeróbico pelo tempo efetivo (segundos).
export function cardioPointsTenths(doneSeconds: number, referenceSeconds: number = DEFAULT_CARDIO_REFERENCE_SECONDS): number {
  if (!(referenceSeconds > 0) || !(doneSeconds > 0)) return 0;
  if (doneSeconds >= referenceSeconds) {
    const blocks = Math.floor((doneSeconds - referenceSeconds) / 600);
    return Math.min(CARDIO_CAP_TENTHS, (10 + blocks) * 10);
  }
  return Math.round((100 * doneSeconds) / referenceSeconds);
}

/// Modo equilibrado: média dos itens previstos (não feitos entram com zero).
export function balancedTenths(totalTenths: number, plannedItems: number): number {
  return plannedItems > 0 ? Math.round(totalTenths / plannedItems) : 0;
}

/// "10,5".
export function formatPoints(tenths: number): string {
  return (tenths / 10).toLocaleString("pt-BR", { minimumFractionDigits: tenths % 10 === 0 ? 0 : 1, maximumFractionDigits: 1 });
}

export type ReferenceKind = "VOLUME" | "REPETICOES" | "TEMPO";

export interface ScoredSet {
  reps: number | null;
  loadGrams: number | null;
  durationSeconds: number | null;
}

/// O que foi feito num item, na unidade da referência.
export function doneFor(kind: ReferenceKind, sets: ScoredSet[]): number {
  if (kind === "TEMPO") return sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
  if (kind === "REPETICOES") return sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  // Volume em gramas·repetição: cargas diferentes série a série somam.
  return sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.loadGrams ?? 0), 0);
}

export function itemPointsTenths(kind: ReferenceKind, done: number, reference: number): number {
  return kind === "TEMPO" ? cardioPointsTenths(done, reference) : strengthPointsTenths(done, reference);
}

/// Como o item é medido: aeróbico por tempo; com carga em alguma série,
/// por volume; sem carga, por repetições × séries.
export function kindFor(cardio: boolean, sets: ScoredSet[]): ReferenceKind {
  if (cardio) return "TEMPO";
  return sets.some((set) => (set.loadGrams ?? 0) > 0) ? "VOLUME" : "REPETICOES";
}
