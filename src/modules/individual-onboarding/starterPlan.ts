import "server-only";
import type { ExperienceLevel, IndividualObjective, PrismaClient, WeeklyAvailability } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { DEFAULT_PRESCRIPTION, ensureDraftTrainingPlanForTenant } from "@/modules/workouts/workouts";
import { STARTER_BLOCKS, type StarterItem, type StarterWorkout } from "@/modules/library/starterLibrary";

/// Plano inicial do FitOS Livre (EPIC-30): as três respostas do onboarding
/// (objetivo, dias, experiência) viram treinos prontos, com dias da
/// semana, a partir dos mesmos blocos da biblioteca do personal. Só cria
/// se o espaço ainda não tem nenhum treino: refazer o onboarding nunca
/// duplica nem apaga o que a pessoa já montou.

const { INFERIORES_A, SUPERIORES_A, INFERIORES_B, SUPERIORES_B, CORPO_TODO_A, CORPO_TODO_B, c, s } = STARTER_BLOCKS;

const BEGINNER_A: StarterItem[] = [s("leg-press-45"), s("chest-press-sentado"), s("puxada-frontal-na-maquina"), s("cadeira-flexora"), s("abdominal-supra", 3, 15)];
const BEGINNER_B: StarterItem[] = [s("cadeira-extensora"), s("remada-baixa-na-maquina"), s("desenvolvimento-na-maquina"), s("mesa-flexora"), s("prancha-frontal", 3, 12)];

function strengthOnly(items: StarterItem[]) {
  return items.filter((item) => !item.minutes);
}

export function pickStarterWorkouts(input: { objective: IndividualObjective; availability: WeeklyAvailability; experience: ExperienceLevel }): StarterWorkout[] {
  const beginner = input.experience === "INICIANTE";
  const lose = input.objective === "PERDER_PESO";
  const mass = input.objective === "GANHAR_MASSA";
  const bodyA = beginner ? BEGINNER_A : lose ? CORPO_TODO_A : strengthOnly(CORPO_TODO_A);
  const bodyB = beginner ? BEGINNER_B : lose ? CORPO_TODO_B : strengthOnly(CORPO_TODO_B);

  if (input.availability === "UM_A_DOIS_DIAS") {
    return [
      { name: "Corpo todo A", days: ["SEGUNDA"], items: bodyA },
      { name: "Corpo todo B", days: ["QUINTA"], items: bodyB },
    ];
  }
  if (input.availability === "TRES_A_QUATRO_DIAS") {
    if (lose) {
      return [
        { name: "Corpo todo A", days: ["SEGUNDA"], items: bodyA },
        { name: "Caminhada inclinada", days: ["TERCA"], items: [c("esteira-inclinada", 30, "MODERADO")] },
        { name: "Corpo todo B", days: ["QUARTA"], items: bodyB },
        { name: beginner ? "Bike leve" : "HIIT na bike", days: ["SEXTA"], items: [beginner ? c("bike", 25, "LEVE") : c("spinning", 24, "INTERVALADO")] },
      ];
    }
    if (beginner) {
      return [
        { name: "Corpo todo A", days: ["SEGUNDA", "QUINTA"], items: bodyA },
        { name: "Corpo todo B", days: ["TERCA", "SEXTA"], items: bodyB },
      ];
    }
    return [
      { name: "Inferiores A", days: ["SEGUNDA"], items: INFERIORES_A },
      { name: "Superiores A", days: ["TERCA"], items: SUPERIORES_A },
      { name: "Inferiores B", days: ["QUINTA"], items: INFERIORES_B },
      { name: "Superiores B", days: ["SEXTA"], items: SUPERIORES_B },
    ];
  }
  // Cinco ou mais dias.
  const split: StarterWorkout[] = beginner
    ? [
        { name: "Corpo todo A", days: ["SEGUNDA", "QUINTA"], items: bodyA },
        { name: "Corpo todo B", days: ["TERCA", "SEXTA"], items: bodyB },
      ]
    : [
        { name: "Inferiores A", days: ["SEGUNDA"], items: INFERIORES_A },
        { name: "Superiores A", days: ["TERCA"], items: SUPERIORES_A },
        { name: "Inferiores B", days: ["QUINTA"], items: INFERIORES_B },
        { name: "Superiores B", days: ["SEXTA"], items: SUPERIORES_B },
      ];
  const cardio: StarterWorkout = mass
    ? { name: "Aeróbico leve", days: ["QUARTA"], items: [c("eliptico", 20, "LEVE")] }
    : lose
      ? { name: "HIIT na bike", days: ["QUARTA", "SABADO"], items: [c("spinning", 24, "INTERVALADO")] }
      : { name: "Caminhada inclinada", days: ["QUARTA"], items: [c("esteira-inclinada", 30, "MODERADO")] };
  return [...split, cardio];
}

export async function createStarterPlanForIndividual(
  input: { tenantId: string; objective: IndividualObjective; availability: WeeklyAvailability; experience: ExperienceLevel },
  client: PrismaClient = prisma
): Promise<{ created: number }> {
  const existing = await client.workout.count({ where: { tenantId: input.tenantId, trainingPlan: { isSnapshot: false } } });
  if (existing > 0) return { created: 0 };
  const defs = pickStarterWorkouts(input);
  const slugs = [...new Set(defs.flatMap((def) => def.items.map((item) => item.slug)))];
  const exercises = await client.exercise.findMany({ where: { externalId: { in: slugs }, tenantId: null, status: "ATIVO" }, select: { id: true, externalId: true } });
  const idBySlug = new Map(exercises.map((exercise) => [exercise.externalId!, exercise.id]));
  const plan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);
  const reps = input.experience === "INICIANTE" ? 12 : null;

  return client.$transaction(async (tx) => {
    let created = 0;
    for (const [position, def] of defs.entries()) {
      const workout = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: plan.id, name: def.name, position, suggestedDays: def.days ?? [] } });
      let index = 0;
      for (const item of def.items) {
        const exerciseId = idBySlug.get(item.slug);
        if (!exerciseId) continue;
        await tx.workoutExercise.create({
          data: item.minutes
            ? { tenantId: input.tenantId, workoutId: workout.id, exerciseId, position: index, durationSeconds: item.minutes * 60, intensity: item.intensity ?? "MODERADO" }
            : {
                tenantId: input.tenantId,
                workoutId: workout.id,
                exerciseId,
                position: index,
                sets: input.experience === "INICIANTE" ? 3 : item.sets,
                reps: item.seconds ? null : (reps ?? item.reps),
                durationSeconds: item.seconds ?? null,
                restSeconds: DEFAULT_PRESCRIPTION.restSeconds,
              },
        });
        index += 1;
      }
      created += 1;
    }
    return { created };
  });
}
