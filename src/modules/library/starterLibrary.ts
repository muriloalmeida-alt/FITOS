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

type Item = { slug: string; sets?: number; reps?: number; seconds?: number; minutes?: number; intensity?: CardioIntensity };
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

const DRAFT_TRAINING_PLAN_NAME = "Meus modelos";

/// Cria a biblioteca inicial do espaço, se ainda não existe. Idempotente:
/// a marca `starterLibraryAt` é gravada na mesma transação e trava uma
/// segunda criação concorrente (`updateMany` condicional).
export async function ensureStarterLibrary(tenantId: string, client: PrismaClient = prisma): Promise<boolean> {
  const tenant = await client.tenant.findUnique({ where: { id: tenantId }, select: { starterLibraryAt: true } });
  if (!tenant || tenant.starterLibraryAt) return false;

  const slugs = [...new Set([...WORKOUTS, ...CARDIO, ...PROGRAMS.flatMap((program) => program.workouts)].flatMap((workout) => workout.items.map((item) => item.slug)))];
  const exercises = await client.exercise.findMany({ where: { externalId: { in: slugs }, tenantId: null, status: "ATIVO" }, select: { id: true, externalId: true } });
  const idBySlug = new Map(exercises.map((exercise) => [exercise.externalId!, exercise.id]));

  return client.$transaction(async (tx) => {
    const claimed = await tx.tenant.updateMany({ where: { id: tenantId, starterLibraryAt: null }, data: { starterLibraryAt: new Date() } });
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
            : { tenantId, workoutId: workout.id, exerciseId, position: index, sets: item.sets, reps: item.seconds ? null : item.reps, durationSeconds: item.seconds ?? null, restSeconds: DEFAULT_PRESCRIPTION.restSeconds },
        });
        index += 1;
      }
    };

    const draft =
      (await tx.trainingPlan.findFirst({ where: { tenantId, isDraftBucket: true } })) ??
      (await tx.trainingPlan.create({ data: { tenantId, name: DRAFT_TRAINING_PLAN_NAME, isDraftBucket: true } }));
    const start = ((await tx.workout.aggregate({ where: { tenantId, trainingPlanId: draft.id }, _max: { position: true } }))._max.position ?? -1) + 1;
    for (const [index, def] of [...WORKOUTS, ...CARDIO].entries()) {
      await createWorkout(draft.id, def, start + index);
    }

    for (const program of PROGRAMS) {
      const plan = await tx.trainingPlan.create({ data: { tenantId, name: program.name, durationWeeks: program.weeks } });
      for (const [index, def] of program.workouts.entries()) {
        await createWorkout(plan.id, def, index);
      }
    }
    return true;
  });
}

export const STARTER_LIBRARY = { workouts: WORKOUTS, cardio: CARDIO, programs: PROGRAMS };
