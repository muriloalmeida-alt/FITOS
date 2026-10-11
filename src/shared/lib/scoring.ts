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
/// - Isometria (regra 2, Funcional): sem repetições nem carga, só tempo
///   (prancha): 1 ponto por 30 s registrados, proporcional; teto de 20.
/// - Bloco com resultado (regra 2, Funcional): 1 ponto por minuto feito
///   (tempo medido, janela do AMRAP, intervalos do EMOM feitos),
///   proporcional; teto de 30 por bloco. Os exercícios do bloco não
///   pontuam de novo pelas séries.
///
/// Pontos guardados em décimos (inteiro) para não acumular erro de ponto
/// flutuante: 10,5 pontos = 105.

export const RULE_VERSION = 2;
export const STRENGTH_CAP_TENTHS = 200;
export const CARDIO_CAP_TENTHS = 150;
export const DEFAULT_CARDIO_REFERENCE_SECONDS = 30 * 60;
export const BLOCK_CAP_TENTHS = 300;
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

/// Isometria: item que não é aeróbico, sem repetições nem carga, com tempo.
export function isIsometric(cardio: boolean, sets: ScoredSet[]): boolean {
  return !cardio && sets.length > 0 && sets.every((set) => !set.reps && !set.loadGrams) && sets.some((set) => (set.durationSeconds ?? 0) > 0);
}

/// 1 ponto por 30 s (décimos: 1 a cada 3 s), teto de 20 pontos.
export function isometricPointsTenths(seconds: number): number {
  return seconds > 0 ? Math.min(STRENGTH_CAP_TENTHS, Math.floor(seconds / 3)) : 0;
}

/// 1 ponto por minuto (décimos: 1 a cada 6 s), teto de 30 pontos.
export function blockPointsTenths(seconds: number): number {
  return seconds > 0 ? Math.min(BLOCK_CAP_TENTHS, Math.floor(seconds / 6)) : 0;
}

export interface ScoredBlock {
  kind: "CIRCUITO" | "AMRAP" | "EMOM" | "FOR_TIME";
  windowSeconds: number | null;
  intervals: number | null;
  intervalSeconds: number | null;
  timeCapSeconds: number | null;
}

export interface ScoredBlockResult {
  outcome: string | null;
  roundsCompleted: number | null;
  partialReps: number | null;
  intervalsCompleted: number | null;
  elapsedSeconds: number | null;
}

/// Minutos realmente feitos num bloco (em segundos). `measuredSeconds` é o
/// timer do treino ao vivo (0 no retroativo, que não tem timer).
/// - EMOM: intervalos feitos × duração do intervalo;
/// - AMRAP: a janela, se fez alguma coisa (o timer, se parou antes);
/// - For Time: o tempo concluído; no limite, o limite; parou antes, o timer;
/// - Circuito: o timer.
export function blockSecondsDone(block: ScoredBlock, result: ScoredBlockResult, measuredSeconds: number): number {
  const measured = Math.max(0, measuredSeconds);
  if (block.kind === "EMOM") return Math.min(result.intervalsCompleted ?? 0, block.intervals ?? Infinity) * (block.intervalSeconds ?? 60);
  if (block.kind === "AMRAP") {
    if (!(result.roundsCompleted || result.partialReps)) return 0;
    const window = block.windowSeconds ?? 0;
    return measured > 0 && (window === 0 || measured < window) ? measured : window;
  }
  if (block.kind === "FOR_TIME") {
    if (result.outcome === "CONCLUIDO") return result.elapsedSeconds ?? measured;
    if (result.outcome === "LIMITE_ATINGIDO") return block.timeCapSeconds ?? measured;
    return block.timeCapSeconds ? Math.min(measured, block.timeCapSeconds) : measured;
  }
  return measured;
}
