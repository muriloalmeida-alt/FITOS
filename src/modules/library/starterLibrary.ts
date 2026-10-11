import "server-only";
import type { CardioIntensity, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { DEFAULT_PRESCRIPTION } from "@/modules/workouts/workouts";

/// Biblioteca inicial (EPIC-28): programas, treinos e aeróbicos prontos que
/// todo personal encontra na primeira visita, para aplicar aos alunos em
/// um toque. Criada uma única vez por espaço (`Tenant.starterLibraryAt`);
/// depois é do personal, que edita, arquiva ou apaga como quiser.
/// Exercícios pelo `externalId` do catálogo curado; um que falte no banco
/// é pulado em silêncio, nunca quebra a criação.

type Item = { slug: string; sets?: number; reps?: number; seconds?: number; minutes?: number; intensity?: CardioIntensity; rest?: number };
interface WorkoutDef {
  name: string;
  days?: string[];
  items: Item[];
}
interface ProgramDef {
  name: string;
  weeks: number;
  workouts: WorkoutDef[];
}

const s = (slug: string, sets: number = DEFAULT_PRESCRIPTION.sets, reps: number = DEFAULT_PRESCRIPTION.reps): Item => ({ slug: `fitos:${slug}`, sets, reps });
/// Isometria por tempo (ex.: prancha): séries de N segundos.
const t = (slug: string, sets: number, seconds: number): Item => ({ slug: `fitos:${slug}`, sets, seconds });
const c = (slug: string, minutes: number, intensity: CardioIntensity): Item => ({ slug: `fitos:aerobico-${slug}`, minutes, intensity });
/// Alongamento ou mobilidade: 2 séries de N segundos, descanso curto.
const m = (slug: string, seconds = 30): Item => ({ slug: `fitos:${slug}`, sets: 2, seconds, rest: 15 });

const INFERIORES_A: Item[] = [s("agachamento-livre-com-barra", 4, 10), s("leg-press-45"), s("mesa-flexora"), s("elevacao-pelvica-com-barra"), s("panturrilha-em-pe-na-maquina", 3, 15)];
const SUPERIORES_A: Item[] = [s("supino-reto-com-barra", 4, 10), s("puxada-alta-pegada-aberta"), s("desenvolvimento-com-halteres-sentado"), s("remada-baixa-na-maquina"), s("triceps-na-polia-com-corda")];
const INFERIORES_B: Item[] = [s("agachamento-bulgaro", 3, 10), s("levantamento-terra-romeno-com-halteres"), s("cadeira-extensora"), s("cadeira-flexora"), s("maquina-abdutora", 3, 15)];
const SUPERIORES_B: Item[] = [s("supino-inclinado-com-halteres"), s("remada-unilateral-com-halter"), s("elevacao-lateral-com-halteres", 3, 15), s("rosca-direta-com-barra"), t("prancha-frontal", 3, 30)];
const CORPO_TODO_A: Item[] = [s("agachamento-goblet"), s("supino-reto-com-halteres"), s("puxada-alta-pegada-neutra"), s("elevacao-pelvica-com-barra"), t("prancha-frontal", 3, 30), c("esteira-inclinada", 15, "MODERADO")];
const CORPO_TODO_B: Item[] = [s("leg-press-45"), s("remada-baixa-na-maquina"), s("desenvolvimento-na-maquina"), s("mesa-flexora"), s("abdominal-supra", 3, 15), c("bike", 15, "MODERADO")];

const WORKOUTS: WorkoutDef[] = [
  { name: "Inferiores A", items: INFERIORES_A },
  { name: "Superiores A", items: SUPERIORES_A },
  { name: "Corpo todo iniciante", items: [s("leg-press-45"), s("chest-press-sentado"), s("puxada-frontal-na-maquina"), s("cadeira-flexora"), s("abdominal-supra", 3, 15)] },
  { name: "Glúteos e posterior", items: [s("elevacao-pelvica-com-barra", 4, 10), s("levantamento-terra-romeno-com-halteres"), s("coice-no-cabo"), s("mesa-flexora"), s("maquina-abdutora", 3, 15)] },
];

const CARDIO: WorkoutDef[] = [
  { name: "HIIT na bike", items: [c("spinning", 24, "INTERVALADO")] },
  { name: "Caminhada inclinada", items: [c("esteira-inclinada", 30, "MODERADO")] },
  { name: "Corrida intervalada", items: [c("esteira-corrida", 25, "INTERVALADO")] },
  { name: "Elíptico contínuo", items: [c("eliptico", 35, "LEVE")] },
];

const PROGRAMS: ProgramDef[] = [
  {
    name: "Hipertrofia 8 semanas",
    weeks: 8,
    workouts: [
      { name: "Inferiores A", days: ["SEGUNDA"], items: INFERIORES_A },
      { name: "Superiores A", days: ["TERCA"], items: SUPERIORES_A },
      { name: "Inferiores B", days: ["QUINTA"], items: INFERIORES_B },
      { name: "Superiores B", days: ["SEXTA"], items: SUPERIORES_B },
    ],
  },
  {
    name: "Emagrecimento 6 semanas",
    weeks: 6,
    workouts: [
      { name: "Corpo todo A", days: ["SEGUNDA", "SEXTA"], items: CORPO_TODO_A },
      { name: "Caminhada inclinada", days: ["TERCA"], items: [c("esteira-inclinada", 30, "MODERADO")] },
      { name: "Corpo todo B", days: ["QUARTA"], items: CORPO_TODO_B },
      { name: "HIIT na bike", days: ["QUINTA"], items: [c("spinning", 24, "INTERVALADO")] },
    ],
  },
  {
    name: "Iniciante corpo todo",
    weeks: 6,
    workouts: [
      { name: "Corpo todo A", days: ["SEGUNDA", "QUINTA"], items: CORPO_TODO_A.slice(0, 5) },
      { name: "Corpo todo B", days: ["TERCA", "SEXTA"], items: CORPO_TODO_B.slice(0, 5) },
    ],
  },
];

// Treinos prontos (EPIC-32): para 30, 45 e 60 minutos por dia, de corpo
// todo, por grupo muscular e aeróbicos (material "Treinos Aeróbicos —
// Catálogo para o FitOS"). Cada um fecha no tempo do nome pela mesma conta
// do app (séries × (40 s + descanso) + minutos de aeróbico).
const t30 = (slug: string, sets = 3, seconds = 30): Item => t(slug, sets, seconds);

const CORPO_TODO_EXPRESS_30: WorkoutDef = { name: "Corpo todo express · 30 min", items: [s("agachamento-goblet"), s("supino-reto-com-halteres"), s("remada-unilateral-com-halter"), s("desenvolvimento-com-halteres-sentado"), c("esteira-inclinada", 10, "MODERADO")] };
const CORPO_TODO_MAQUINAS_30: WorkoutDef = { name: "Corpo todo máquinas · 30 min", items: [s("leg-press-45"), s("chest-press-sentado"), s("puxada-frontal-na-maquina"), s("mesa-flexora"), s("desenvolvimento-na-maquina"), s("abdominal-na-maquina", 3, 15)] };
const CORPO_TODO_CASA_30: WorkoutDef = { name: "Corpo todo em casa · 30 min", items: [c("circuito-funcional", 12, "INTERVALADO"), s("agachamento-livre", 3, 15), s("flexao-de-bracos", 3, 10), s("afundo-reverso", 3, 10), t30("prancha-frontal")] };
const CORPO_TODO_45: WorkoutDef = { name: "Corpo todo · 45 min", items: [s("agachamento-livre-com-barra", 4, 8), s("supino-reto-com-barra", 4, 8), s("remada-curvada-com-barra", 3, 10), s("levantamento-terra-romeno-com-halteres", 3, 10), s("desenvolvimento-com-halteres-sentado", 3, 10), s("puxada-alta-pegada-neutra", 3, 10), t30("prancha-frontal"), c("bike", 8, "MODERADO")] };
const CORPO_TODO_HALTERES_45: WorkoutDef = { name: "Corpo todo halteres · 45 min", items: [s("agachamento-goblet"), s("supino-inclinado-com-halteres"), s("remada-com-halteres-no-banco-inclinado"), s("step-up-com-halteres", 3, 10), s("elevacao-lateral-com-halteres", 3, 15), s("rosca-alternada-com-halteres"), s("triceps-frances-com-halter"), t("farmer-walk", 3, 40), c("eliptico", 5, "LEVE")] };
const CORPO_TODO_60: WorkoutDef = { name: "Corpo todo · 60 min", items: [c("remo", 5, "LEVE"), s("agachamento-livre-com-barra", 4, 8), s("supino-reto-com-barra", 4, 8), s("puxada-alta-pegada-aberta", 4, 10), s("levantamento-terra-romeno-com-barra", 3, 10), s("desenvolvimento-militar-com-barra", 3, 10), s("remada-baixa-no-cabo"), s("avanco-com-halteres", 3, 10), s("rosca-direta-com-barra", 3, 10), s("triceps-na-polia-com-corda"), t30("prancha-lateral")] };

const PEITO_TRICEPS_45: WorkoutDef = { name: "Peito e tríceps · 45 min", items: [s("supino-reto-com-barra", 4, 10), s("supino-inclinado-com-halteres", 3, 10), s("crucifixo-na-maquina-peck-deck"), s("crossover-medio"), s("triceps-na-polia-com-corda"), s("triceps-frances-com-halter"), s("mergulho-na-maquina"), c("esteira-inclinada", 8, "MODERADO")] };
const COSTAS_BICEPS_45: WorkoutDef = { name: "Costas e bíceps · 45 min", items: [s("puxada-alta-pegada-aberta", 4, 10), s("remada-curvada-com-barra", 3, 10), s("remada-baixa-no-cabo"), s("pulldown-com-bracos-estendidos"), s("face-pull", 3, 15), s("rosca-direta-com-barra-w", 3, 10), s("rosca-martelo"), c("remo", 8, "MODERADO")] };
const INFERIORES_45: WorkoutDef = { name: "Inferiores · 45 min", items: [s("agachamento-hack", 4, 10), s("leg-press-horizontal"), s("cadeira-extensora"), s("stiff-com-barra", 3, 10), s("cadeira-flexora"), s("ponte-de-gluteos-com-halter"), s("panturrilha-sentada-na-maquina", 3, 15), c("esteira-inclinada", 8, "MODERADO")] };
const PERNAS_60: WorkoutDef = { name: "Pernas completo · 60 min", items: [s("agachamento-livre-com-barra", 4, 8), s("leg-press-45", 4, 12), s("agachamento-bulgaro", 3, 10), s("cadeira-extensora"), s("levantamento-terra-romeno-com-barra", 3, 10), s("mesa-flexora"), s("elevacao-pelvica-com-barra", 4, 10), s("maquina-abdutora", 3, 15), s("panturrilha-em-pe-na-maquina", 4, 15), c("bike", 7, "LEVE")] };
const GLUTEOS_30: WorkoutDef = { name: "Glúteos e posterior · 30 min", items: [s("elevacao-pelvica-com-barra", 4, 10), s("levantamento-terra-romeno-com-halteres", 3, 10), s("coice-no-cabo"), s("cadeira-flexora"), s("maquina-abdutora", 3, 15), c("escada", 5, "MODERADO")] };
const OMBROS_ABDOMEN_30: WorkoutDef = { name: "Ombros e abdômen · 30 min", items: [s("desenvolvimento-com-halteres-sentado", 3, 10), s("elevacao-lateral-com-halteres", 3, 15), s("crucifixo-inverso-com-halteres"), s("elevacao-frontal-no-cabo"), s("abdominal-bicicleta", 3, 20), t30("prancha-frontal")] };
const SUPERIORES_60: WorkoutDef = { name: "Superiores · 60 min", items: [s("supino-reto-com-halteres", 4, 10), s("puxada-alta-pegada-neutra", 4, 10), s("supino-inclinado-na-maquina"), s("remada-baixa-na-maquina"), s("desenvolvimento-arnold", 3, 10), s("elevacao-lateral-no-cabo", 3, 15), s("crucifixo-inverso-na-maquina"), s("rosca-alternada-com-halteres"), s("triceps-na-polia-com-barra"), s("rosca-martelo"), s("triceps-coice-com-halter")] };
const CORE_MOBILIDADE_30: WorkoutDef = { name: "Core e mobilidade · 30 min", items: [c("marcha", 5, "LEVE"), m("world-greatest-stretch"), m("mobilidade-90-90-de-quadril"), { slug: "fitos:rotacao-toracica-em-quatro-apoios", sets: 2, reps: 10, rest: 15 }, s("dead-bug", 3, 10), s("bird-dog", 3, 10), t30("prancha-lateral"), s("pallof-press"), m("postura-da-crianca")] };
const RECUPERACAO_30: WorkoutDef = { name: "Recuperação ativa · 30 min", items: [c("esteira-caminhada", 20, "LEVE"), m("alongamento-de-quadriceps-em-pe"), m("alongamento-de-posteriores-sentado"), m("alongamento-do-flexor-do-quadril-ajoelhado"), m("alongamento-de-peitoral-na-parede"), m("postura-da-crianca"), m("rotacao-lombar-deitada")] };

const LISS_45: WorkoutDef = { name: "LISS caminhada inclinada · 45 min", items: [c("esteira-inclinada", 45, "LEVE")] };
const HIIT_ESTEIRA_30: WorkoutDef = { name: "HIIT na esteira · 30 min", items: [c("esteira-corrida", 30, "INTERVALADO")] };
const LONGAO_BIKE_60: WorkoutDef = { name: "Longão na bike · 60 min", items: [c("bike", 60, "LEVE")] };
const CARDIO_MISTO_60: WorkoutDef = { name: "Cardio misto · 60 min", items: [c("remo", 15, "MODERADO"), c("escada", 10, "MODERADO"), c("eliptico", 20, "MODERADO"), c("spinning", 15, "INTERVALADO")] };
const CIRCUITO_CASA_30: WorkoutDef = { name: "Circuito em casa · 30 min", items: [c("marcha", 5, "LEVE"), c("circuito-funcional", 25, "INTERVALADO")] };
const BOXE_30: WorkoutDef = { name: "Boxe intervalado · 30 min", items: [c("boxe", 30, "INTERVALADO")] };
const NATACAO_45: WorkoutDef = { name: "Natação contínua · 45 min", items: [c("natacao", 45, "MODERADO")] };
const DANCA_45: WorkoutDef = { name: "Dança · 45 min", items: [c("danca", 45, "MODERADO")] };

const READY_WORKOUTS: WorkoutDef[] = [
  CORPO_TODO_EXPRESS_30, CORPO_TODO_MAQUINAS_30, CORPO_TODO_CASA_30, CORPO_TODO_45, CORPO_TODO_HALTERES_45, CORPO_TODO_60,
  PEITO_TRICEPS_45, COSTAS_BICEPS_45, INFERIORES_45, PERNAS_60, GLUTEOS_30, OMBROS_ABDOMEN_30, SUPERIORES_60, CORE_MOBILIDADE_30, RECUPERACAO_30,
];
const READY_CARDIO: WorkoutDef[] = [LISS_45, HIIT_ESTEIRA_30, LONGAO_BIKE_60, CARDIO_MISTO_60, CIRCUITO_CASA_30, BOXE_30, NATACAO_45, DANCA_45];
const day = (def: WorkoutDef, days: string[]): WorkoutDef => ({ ...def, days });
const READY_PROGRAMS: ProgramDef[] = [
  { name: "Corpo todo 3× · 30 min", weeks: 6, workouts: [day(CORPO_TODO_MAQUINAS_30, ["SEGUNDA"]), day(CORPO_TODO_EXPRESS_30, ["QUARTA"]), day(CORPO_TODO_CASA_30, ["SEXTA"])] },
  { name: "Corpo todo 3× · 45 min", weeks: 8, workouts: [day(CORPO_TODO_45, ["SEGUNDA", "SEXTA"]), day(CORPO_TODO_HALTERES_45, ["QUARTA"])] },
  { name: "Divisão ABC · 60 min", weeks: 8, workouts: [day(SUPERIORES_60, ["SEGUNDA", "QUINTA"]), day(PERNAS_60, ["TERCA", "SEXTA"]), day(CARDIO_MISTO_60, ["QUARTA"])] },
  { name: "Emagrecimento · 45 min", weeks: 8, workouts: [day(CORPO_TODO_45, ["SEGUNDA", "QUARTA", "SEXTA"]), day(LISS_45, ["TERCA", "QUINTA"]), day(HIIT_ESTEIRA_30, ["SABADO"])] },
];

const DRAFT_TRAINING_PLAN_NAME = "Meus modelos";

/// Versões da biblioteca inicial. Cada espaço recebe uma vez cada versão
/// que ainda não tem — quem já tinha a primeira recebe só os treinos
/// prontos novos, sem duplicar nada.
const VERSIONS: { version: number; workouts: WorkoutDef[]; programs: ProgramDef[] }[] = [
  { version: 1, workouts: [...WORKOUTS, ...CARDIO], programs: PROGRAMS },
  { version: 2, workouts: [...READY_WORKOUTS, ...READY_CARDIO], programs: READY_PROGRAMS },
];
export const STARTER_LIBRARY_VERSION = VERSIONS.at(-1)!.version;

/// Cria (ou completa) a biblioteca inicial do espaço. Idempotente: a
/// versão é gravada na mesma transação com um `updateMany` condicional, que
/// trava uma segunda criação concorrente.
export async function ensureStarterLibrary(tenantId: string, client: PrismaClient = prisma): Promise<boolean> {
  const tenant = await client.tenant.findUnique({ where: { id: tenantId }, select: { starterLibraryVersion: true } });
  if (!tenant || tenant.starterLibraryVersion >= STARTER_LIBRARY_VERSION) return false;
  const pending = VERSIONS.filter((entry) => entry.version > tenant.starterLibraryVersion);

  const slugs = [...new Set(pending.flatMap((entry) => [...entry.workouts, ...entry.programs.flatMap((program) => program.workouts)]).flatMap((workout) => workout.items.map((item) => item.slug)))];
  const exercises = await client.exercise.findMany({ where: { externalId: { in: slugs }, tenantId: null, status: "ATIVO" }, select: { id: true, externalId: true } });
  const idBySlug = new Map(exercises.map((exercise) => [exercise.externalId!, exercise.id]));

  return client.$transaction(
    async (tx) => {
      const claimed = await tx.tenant.updateMany({
        where: { id: tenantId, starterLibraryVersion: tenant.starterLibraryVersion },
        data: { starterLibraryVersion: STARTER_LIBRARY_VERSION, starterLibraryAt: new Date() },
      });
      if (claimed.count === 0) return false;

      const createWorkout = async (planId: string, def: WorkoutDef, position: number) => {
        const workout = await tx.workout.create({ data: { tenantId, trainingPlanId: planId, name: def.name, position, suggestedDays: def.days ?? [] } });
        let index = 0;
        for (const item of def.items) {
          const exerciseId = idBySlug.get(item.slug);
          if (!exerciseId) continue;
          await tx.workoutExercise.create({
            data: item.minutes
              ? { tenantId, workoutId: workout.id, exerciseId, position: index, durationSeconds: item.minutes * 60, intensity: item.intensity ?? "MODERADO" }
              : { tenantId, workoutId: workout.id, exerciseId, position: index, sets: item.sets, reps: item.seconds ? null : item.reps, durationSeconds: item.seconds ?? null, restSeconds: item.rest ?? DEFAULT_PRESCRIPTION.restSeconds },
          });
          index += 1;
        }
      };

      const draft =
        (await tx.trainingPlan.findFirst({ where: { tenantId, isDraftBucket: true } })) ??
        (await tx.trainingPlan.create({ data: { tenantId, name: DRAFT_TRAINING_PLAN_NAME, isDraftBucket: true } }));
      let position = ((await tx.workout.aggregate({ where: { tenantId, trainingPlanId: draft.id }, _max: { position: true } }))._max.position ?? -1) + 1;
      for (const entry of pending) {
        for (const def of entry.workouts) {
          await createWorkout(draft.id, def, position);
          position += 1;
        }
        for (const program of entry.programs) {
          const plan = await tx.trainingPlan.create({ data: { tenantId, name: program.name, durationWeeks: program.weeks } });
          for (const [index, def] of program.workouts.entries()) {
            await createWorkout(plan.id, def, index);
          }
        }
      }
      return true;
    },
    { timeout: 60_000 }
  );
}

export const STARTER_LIBRARY = { workouts: [...WORKOUTS, ...READY_WORKOUTS], cardio: [...CARDIO, ...READY_CARDIO], programs: [...PROGRAMS, ...READY_PROGRAMS] };

/// Blocos para montar o plano inicial do FitOS Livre (EPIC-30).
export const STARTER_BLOCKS = { INFERIORES_A, SUPERIORES_A, INFERIORES_B, SUPERIORES_B, CORPO_TODO_A, CORPO_TODO_B, c, s };
export type StarterItem = Item;
export type StarterWorkout = WorkoutDef;
