/// Funcional e CrossFit (feature 1, etapa 2): blocos do treino (PDF
/// "1-CrossFit_Funcionais", seção 04). Puro. Um treino sem blocos continua
/// sendo séries tradicionais; com blocos, cada item aponta para um bloco
/// pela `key`. Os tempos aqui são metas da prescrição, nunca medição.

export const BLOCK_KINDS = ["CIRCUITO", "AMRAP", "EMOM", "FOR_TIME"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface WorkoutBlock {
  key: string;
  kind: BlockKind;
  /// "Aquecimento", "Força", "WOD"... (opcional).
  name: string | null;
  /// Circuito: voltas. For Time: rounds a completar (opcional).
  rounds: number | null;
  /// AMRAP: janela planejada, em segundos.
  windowSeconds: number | null;
  /// EMOM: número de intervalos e duração de cada um (padrão 60 s).
  intervals: number | null;
  intervalSeconds: number | null;
  /// For Time: limite de tempo (opcional).
  timeCapSeconds: number | null;
  /// Circuito: descanso entre voltas (opcional).
  restSeconds: number | null;
}

export const BLOCK_LABEL: Record<BlockKind, string> = { CIRCUITO: "Circuito", AMRAP: "AMRAP", EMOM: "EMOM", FOR_TIME: "For Time" };

export const BLOCK_HELP: Record<BlockKind, string> = {
  CIRCUITO: "Sequência repetida por voltas.",
  AMRAP: "O máximo de voltas possível dentro da janela.",
  EMOM: "Uma tarefa no começo de cada minuto (ou intervalo).",
  FOR_TIME: "Completar a sequência o mais rápido possível, com limite opcional.",
};

export const MAX_BLOCKS = 10;
const MAX_ROUNDS = 100;
const MAX_SECONDS = 4 * 3600;

export class BlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockError";
  }
}

function optionalInt(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new BlockError(`${label} inválido.`);
  return value;
}

/// Valida e normaliza um bloco vindo do cliente (ou do banco).
export function parseBlock(input: unknown): WorkoutBlock {
  const raw = (input ?? {}) as Record<string, unknown>;
  const kind = raw.kind;
  if (typeof kind !== "string" || !(BLOCK_KINDS as readonly string[]).includes(kind)) throw new BlockError("Tipo de bloco inválido.");
  const key = typeof raw.key === "string" && /^[a-z0-9-]{1,24}$/.test(raw.key) ? raw.key : null;
  if (!key) throw new BlockError("Bloco sem identificação.");
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : null;
  const block: WorkoutBlock = {
    key,
    kind: kind as BlockKind,
    name,
    rounds: optionalInt(raw.rounds, "Número de voltas", 1, MAX_ROUNDS),
    windowSeconds: optionalInt(raw.windowSeconds, "Janela", 60, MAX_SECONDS),
    intervals: optionalInt(raw.intervals, "Número de intervalos", 1, 120),
    intervalSeconds: optionalInt(raw.intervalSeconds, "Duração do intervalo", 10, 600),
    timeCapSeconds: optionalInt(raw.timeCapSeconds, "Limite de tempo", 60, MAX_SECONDS),
    restSeconds: optionalInt(raw.restSeconds, "Descanso", 0, 600),
  };
  // Cada formato pede o que define o bloco; o resto não se aplica.
  if (block.kind === "CIRCUITO") {
    if (!block.rounds) throw new BlockError("Informe quantas voltas tem o circuito.");
    return { ...block, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: null };
  }
  if (block.kind === "AMRAP") {
    if (!block.windowSeconds) throw new BlockError("Informe a janela do AMRAP.");
    return { ...block, rounds: null, intervals: null, intervalSeconds: null, timeCapSeconds: null, restSeconds: null };
  }
  if (block.kind === "EMOM") {
    if (!block.intervals) throw new BlockError("Informe quantos intervalos tem o EMOM.");
    return { ...block, intervalSeconds: block.intervalSeconds ?? 60, rounds: null, windowSeconds: null, timeCapSeconds: null, restSeconds: null };
  }
  return { ...block, windowSeconds: null, intervals: null, intervalSeconds: null, restSeconds: null };
}

/// Lista de blocos do treino: válida, sem chave repetida, no máximo 10.
export function parseBlocks(input: unknown): WorkoutBlock[] {
  if (input === null || input === undefined) return [];
  if (!Array.isArray(input)) throw new BlockError("Blocos inválidos.");
  if (input.length > MAX_BLOCKS) throw new BlockError(`No máximo ${MAX_BLOCKS} blocos por treino.`);
  const blocks = input.map(parseBlock);
  if (new Set(blocks.map((block) => block.key)).size !== blocks.length) throw new BlockError("Blocos repetidos.");
  return blocks;
}

/// Leitura tolerante do banco: o que não for válido é ignorado (nunca derruba a tela).
export function readBlocks(stored: unknown): WorkoutBlock[] {
  try {
    return parseBlocks(stored);
  } catch {
    return [];
  }
}

function minutes(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/// "AMRAP 10 min", "Circuito · 3 voltas", "EMOM 12 × 1 min", "For Time · limite 15 min".
export function blockSummary(block: WorkoutBlock): string {
  const head = block.name ? `${block.name} · ` : "";
  if (block.kind === "CIRCUITO") return `${head}Circuito · ${block.rounds} ${block.rounds === 1 ? "volta" : "voltas"}${block.restSeconds ? ` · ${block.restSeconds} s entre voltas` : ""}`;
  if (block.kind === "AMRAP") return `${head}AMRAP ${minutes(block.windowSeconds ?? 0)}`;
  if (block.kind === "EMOM") return `${head}EMOM ${block.intervals} × ${minutes(block.intervalSeconds ?? 60)}`;
  return `${head}For Time${block.rounds ? ` · ${block.rounds} ${block.rounds === 1 ? "round" : "rounds"}` : ""}${block.timeCapSeconds ? ` · limite ${minutes(block.timeCapSeconds)}` : ""}`;
}

/// Itens agrupados na ordem do treino: os sem bloco (séries tradicionais)
/// primeiro, depois cada bloco na ordem definida.
export function groupByBlock<T extends { blockKey: string | null }>(items: T[], blocks: WorkoutBlock[]): { block: WorkoutBlock | null; items: T[] }[] {
  const known = new Set(blocks.map((block) => block.key));
  const loose = items.filter((item) => !item.blockKey || !known.has(item.blockKey));
  return [...(loose.length ? [{ block: null, items: loose }] : []), ...blocks.map((block) => ({ block, items: items.filter((item) => item.blockKey === block.key) }))];
}
