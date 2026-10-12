import type { ExperienceLevel } from "@prisma/client";
import type { Modality } from "@/shared/lib/modalities";
import type { WorkoutBlock } from "@/shared/lib/workoutBlocks";

/// Programas prontos de Funcional e CrossFit (proposta 11, material
/// "FitOS — Funcional e CrossFit", versão 1): 4 programas e 12 treinos,
/// copiados como estão. Formatos em blocos (ADR-020): circuito, AMRAP,
/// EMOM e For Time — nunca convertidos em séries. Carga individualizada
/// (sem carga prescrita). Cada exercício é resolvido explicitamente no
/// catálogo; faltar um aborta a cópia (`strict`), nunca pula em silêncio.

export interface ModalityItem {
  slug: string;
  reps?: number;
  seconds?: number;
  meters?: number;
  /// "por lado", "adaptado"...
  note?: string;
  /// Faixa do material quando há uma ("8–12 repetições"); `reps` guarda o mínimo.
  range?: string;
  block: string;
}

export interface ModalityWorkout {
  name: string;
  days: string[];
  /// Formato como no material (para a tela de detalhes).
  format: string;
  blocks: WorkoutBlock[];
  items: ModalityItem[];
}

export interface ModalityProgram {
  name: string;
  modalities: Modality[];
  level: ExperienceLevel;
  weeks: number;
  weeklyFrequency: number;
  minutes: { min: number; max: number };
  workouts: ModalityWorkout[];
}

export const MODALITY_PROGRAM_NOTES = {
  warmup: "Aquecimento de 5 a 8 minutos, ajustado aos movimentos do dia.",
  load: "Carga individualizada pelo personal.",
  progression: ["Semana 1: familiarização e volume inicial.", "Semana 2: consolidar a técnica.", "Semana 3: aumentar uma única variável, só com aprovação do personal.", "Semana 4: revisar e definir o próximo ciclo."],
};

const KEY = "principal";
const circuit = (rounds: number, restSeconds: number): WorkoutBlock => ({ key: KEY, kind: "CIRCUITO", name: null, rounds, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: null, restSeconds });
const amrap = (minutes: number): WorkoutBlock => ({ key: KEY, kind: "AMRAP", name: null, rounds: null, windowSeconds: minutes * 60, intervals: null, intervalSeconds: null, timeCapSeconds: null, restSeconds: null });
const emom = (intervals: number, intervalSeconds: number): WorkoutBlock => ({ key: KEY, kind: "EMOM", name: null, rounds: null, windowSeconds: null, intervals, intervalSeconds, timeCapSeconds: null, restSeconds: null });
const forTime = (rounds: number, capMinutes: number): WorkoutBlock => ({ key: KEY, kind: "FOR_TIME", name: null, rounds, windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: capMinutes * 60, restSeconds: null });

const reps = (slug: string, count: number, note?: string, range?: string): ModalityItem => ({ slug: `fitos:${slug}`, reps: count, note, range, block: KEY });
const secs = (slug: string, seconds: number, note?: string): ModalityItem => ({ slug: `fitos:${slug}`, seconds, note, block: KEY });
const meters = (slug: string, distance: number, note?: string): ModalityItem => ({ slug: `fitos:${slug}`, meters: distance, note, block: KEY });

const BETWEEN_2 = "Circuito de 2 voltas; 30–45 segundos entre exercícios e 90 segundos entre voltas.";
const BETWEEN_3 = "Circuito de 3 voltas; 30–60 segundos entre exercícios e 90 segundos entre voltas.";

export const MODALITY_PROGRAMS: ModalityProgram[] = [
  {
    name: "Funcional — Primeiros Passos",
    modalities: ["funcional"],
    level: "INICIANTE",
    weeks: 4,
    weeklyFrequency: 3,
    minutes: { min: 25, max: 35 },
    workouts: [
      { name: "Base e estabilidade", days: ["SEGUNDA"], format: BETWEEN_2, blocks: [circuit(2, 90)], items: [reps("agachamento-ate-o-banco", 10), reps("flexao-inclinada", 8), reps("remada-com-elastico", 12), reps("ponte-de-gluteos", 12), reps("bird-dog", 6, "por lado")] },
      { name: "Movimento e equilíbrio", days: ["QUARTA"], format: BETWEEN_2, blocks: [circuit(2, 90)], items: [reps("step-up", 8, "por lado, em degrau baixo"), reps("levantamento-terra-com-kettlebell", 10), reps("remada-suspensa", 8), reps("pallof-press", 8, "por lado"), secs("aerobico-marcha", 60, "marcha no lugar")] },
      { name: "Corpo inteiro", days: ["SEXTA"], format: BETWEEN_2, blocks: [circuit(2, 90)], items: [reps("agachamento-livre", 10), reps("flexao-inclinada", 8, "na parede ou em apoio elevado"), reps("remada-com-elastico", 12), meters("farmer-carry", 20), reps("dead-bug", 6, "por lado")] },
    ],
  },
  {
    name: "Funcional — Evolução",
    modalities: ["funcional"],
    level: "INTERMEDIARIO",
    weeks: 4,
    weeklyFrequency: 3,
    minutes: { min: 35, max: 45 },
    workouts: [
      { name: "Força em movimento", days: ["SEGUNDA"], format: BETWEEN_3, blocks: [circuit(3, 90)], items: [reps("agachamento-goblet", 10), reps("afundo-reverso", 8, "por lado"), reps("flexao-de-bracos", 8, "adaptada", "8–12 repetições"), reps("remada-suspensa", 10), meters("farmer-carry", 30)] },
      { name: "Condicionamento", days: ["QUARTA"], format: BETWEEN_3, blocks: [circuit(3, 90)], items: [reps("step-up", 10, "por lado"), reps("levantamento-terra-com-kettlebell", 12), reps("remada-com-elastico", 12), secs("aerobico-mountain-climber", 20, "controlado"), secs("aerobico-bike", 90)] },
      { name: "Controle e resistência", days: ["SEXTA"], format: BETWEEN_3, blocks: [circuit(3, 90)], items: [reps("afundo-lateral", 8, "por lado"), reps("flexao-de-bracos", 8, "adaptada", "8–12 repetições"), reps("remada-unilateral-com-halter", 10, "por lado"), meters("suitcase-carry-unilateral", 20, "por lado"), secs("prancha-lateral", 20, "por lado")] },
    ],
  },
  {
    name: "CrossFit — Fundamentos",
    modalities: ["crossfit"],
    level: "INICIANTE",
    weeks: 4,
    weeklyFrequency: 3,
    minutes: { min: 30, max: 40 },
    workouts: [
      { name: "Agachar, empurrar e puxar", days: ["SEGUNDA"], format: "3 voltas; descansar entre voltas. Prática técnica: agachamento livre, flexão inclinada e remada suspensa.", blocks: [circuit(3, 90)], items: [reps("agachamento-livre", 8), reps("flexao-inclinada", 6), reps("remada-suspensa", 8), secs("aerobico-bike", 60)] },
      { name: "Levantar e carregar", days: ["QUARTA"], format: "4 blocos de 3 minutos: realizar os movimentos e descansar no tempo restante. Prática técnica: terra com kettlebell e farmer carry.", blocks: [emom(4, 180)], items: [reps("levantamento-terra-com-kettlebell", 8), meters("farmer-carry", 20), secs("aerobico-bike", 45)] },
      { name: "Ritmo e coordenação", days: ["SEXTA"], format: "3 voltas. Prática técnica: subida em degrau, remada e estabilidade do tronco.", blocks: [circuit(3, 90)], items: [secs("aerobico-remo", 90, "remo ou bicicleta"), reps("step-up", 8, "por lado"), reps("remada-suspensa", 8), secs("prancha-frontal", 20)] },
    ],
  },
  {
    name: "CrossFit — Condicionamento",
    modalities: ["crossfit"],
    level: "INTERMEDIARIO",
    weeks: 4,
    weeklyFrequency: 3,
    minutes: { min: 40, max: 50 },
    workouts: [
      { name: "Resistência contínua", days: ["SEGUNDA"], format: "AMRAP de 12 minutos: repetir o circuito com boa técnica, descansando quando necessário.", blocks: [amrap(12)], items: [reps("agachamento-goblet", 10), reps("flexao-de-bracos", 8, "adaptada"), reps("remada-suspensa", 10), meters("aerobico-remo", 100)] },
      { name: "Intervalos", days: ["QUARTA"], format: "EMOM de 15 minutos: minuto 1, terra; minuto 2, subida em degrau; minuto 3, bicicleta. Repetir cinco vezes e descansar no restante de cada minuto.", blocks: [emom(15, 60)], items: [reps("levantamento-terra-com-kettlebell", 10), reps("step-up", 8, "repetições totais"), secs("aerobico-bike", 40)] },
      { name: "Circuito misto", days: ["SEXTA"], format: "3 voltas, limite de 15 minutos. Encerrar no limite mesmo que sobrem repetições.", blocks: [forTime(3, 15)], items: [reps("wall-ball", 8, "adaptado"), meters("farmer-carry", 30), reps("aerobico-burpee", 6, "sem salto"), meters("aerobico-remo", 150)] },
    ],
  },
];

export const MODALITY_PROGRAM_SLUGS = [...new Set(MODALITY_PROGRAMS.flatMap((program) => program.workouts.flatMap((workout) => workout.items.map((item) => item.slug))))];
