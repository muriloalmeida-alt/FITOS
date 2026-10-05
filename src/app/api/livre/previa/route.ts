import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { pickStarterWorkouts } from "@/modules/individual-onboarding/starterPlan";
import { estimateMinutes } from "@/modules/students/studentHome";

const OBJECTIVES: IndividualObjective[] = ["GANHAR_MASSA", "PERDER_PESO", "CONDICIONAMENTO_GERAL", "SAUDE_E_BEM_ESTAR", "OUTRO"];
const EXPERIENCES: ExperienceLevel[] = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];
const AVAILABILITIES: WeeklyAvailability[] = ["UM_A_DOIS_DIAS", "TRES_A_QUATRO_DIAS", "CINCO_OU_MAIS_DIAS"];

/// Prévia do plano inicial do FitOS Livre (EPIC-33): antes de criar a
/// conta, a pessoa vê os treinos que as três respostas geram. Pública e
/// sem gravar nada — só calcula a partir das respostas.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const objective = params.get("objetivo") as IndividualObjective;
  const experience = params.get("experiencia") as ExperienceLevel;
  const availability = params.get("dias") as WeeklyAvailability;
  if (!OBJECTIVES.includes(objective) || !EXPERIENCES.includes(experience) || !AVAILABILITIES.includes(availability)) {
    return Response.json({ error: "VALIDACAO", message: "Respostas inválidas." }, { status: 400 });
  }
  const workouts = pickStarterWorkouts({ objective, experience, availability }).map((workout) => ({
    name: workout.name,
    days: workout.days ?? [],
    exercises: workout.items.length,
    minutes: estimateMinutes(
      workout.items.map((item) => ({
        sets: item.minutes ? null : experience === "INICIANTE" ? 3 : (item.sets ?? 3),
        durationSeconds: item.minutes ? item.minutes * 60 : (item.seconds ?? null),
        restSeconds: item.rest ?? 60,
        intensity: item.minutes ? (item.intensity ?? "MODERADO") : null,
      }))
    ),
  }));
  return Response.json({ workouts });
}
