import "server-only";
import type { ExperienceLevel, IndividualObjective, PrismaClient, WeeklyAvailability } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { MODALITY_LABEL, type Modality } from "@/shared/lib/modalities";
import { recommendPrograms } from "@/shared/lib/programRecommendation";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { estimateMinutes } from "@/modules/students/studentHome";
import { pickStarterWorkouts } from "@/modules/individual-onboarding/starterPlan";
import { getRecommendablePrograms } from "./readyLibrary";
import type { RecommendationOption, Recommendations } from "./recommendationTypes";

export type { ProgramChoice, RecommendationOption, Recommendations } from "./recommendationTypes";

/// Recomendações do onboarding do FitOS Livre (proposta 11): programas
/// prontos das modalidades escolhidas, mais compatíveis primeiro. Em
/// Musculação, o plano montado pelas três respostas continua sendo a
/// primeira opção (é o programa mais compatível que o FitOS já monta).
/// Nada é gravado aqui.

const LEVEL_LABEL: Record<ExperienceLevel, string> = { INICIANTE: "Iniciante", INTERMEDIARIO: "Intermediário", AVANCADO: "Avançado" };
const PER_GROUP = 3;

function daysLabel(days: string[] = []): string {
  return WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.short.toLowerCase()).join(" e ");
}

function starterOption(input: { objective: IndividualObjective; experience: ExperienceLevel; availability: WeeklyAvailability }): RecommendationOption {
  const workouts = pickStarterWorkouts(input);
  const days = new Set(workouts.flatMap((workout) => workout.days ?? []));
  const minutes = workouts.map((workout) =>
    estimateMinutes(workout.items.map((item) => ({ sets: item.minutes ? null : input.experience === "INICIANTE" ? 3 : (item.sets ?? 3), durationSeconds: item.minutes ? item.minutes * 60 : (item.seconds ?? null), restSeconds: item.rest ?? 60, intensity: item.minutes ? (item.intensity ?? "MODERADO") : null })))
  );
  return {
    choice: { kind: "inicial" },
    name: "Plano de musculação pelas suas respostas",
    modalityLabel: MODALITY_LABEL.musculacao,
    facts: [`${days.size} ${days.size === 1 ? "dia" : "dias"} por semana`, Math.min(...minutes) === Math.max(...minutes) ? `cerca de ${minutes[0]} min` : `cerca de ${Math.min(...minutes)}–${Math.max(...minutes)} min`],
    notes: ["Montado a partir do seu objetivo, experiência e dias disponíveis."],
    workouts: workouts.map((workout) => ({ name: workout.name, days: daysLabel(workout.days), format: null, exercises: [] })),
  };
}

export async function buildRecommendations(
  input: { modalities: Modality[]; objective: IndividualObjective; experience: ExperienceLevel; availability: WeeklyAvailability },
  client: PrismaClient = prisma
): Promise<Recommendations> {
  const programs = await getRecommendablePrograms(client);
  const { groups, missing } = recommendPrograms(programs, { modalities: input.modalities, level: input.experience, availability: input.availability });
  return {
    missing,
    groups: groups.map((group) => {
      const options: RecommendationOption[] = group.programs.slice(0, PER_GROUP).map((program) => ({
        choice: { kind: "programa", key: program.key },
        name: program.name,
        modalityLabel: program.modalityLabel,
        facts: [
          program.weeklyFrequency ? `${program.weeklyFrequency} ${program.weeklyFrequency === 1 ? "dia" : "dias"} por semana` : null,
          program.weeks ? `${program.weeks} semanas` : null,
          program.minutes ? `${program.minutes.min}–${program.minutes.max} min por sessão` : null,
          program.level ? LEVEL_LABEL[program.level] : null,
        ].filter((fact): fact is string => Boolean(fact)),
        notes: program.notes,
        workouts: program.workouts,
      }));
      const strengthOnly = group.modalities.length === 1 && group.modalities[0] === "musculacao";
      return {
        modalities: group.modalities,
        label: group.modalities.map((modality) => MODALITY_LABEL[modality]).join(" + "),
        options: strengthOnly ? [starterOption(input), ...options.slice(0, PER_GROUP - 1)] : options,
      };
    }),
  };
}
