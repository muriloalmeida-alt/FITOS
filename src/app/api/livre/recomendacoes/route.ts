import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { buildRecommendations } from "@/modules/library/recommendations";
import { ModalityError, parseModalities } from "@/shared/lib/modalities";

const OBJECTIVES: IndividualObjective[] = ["GANHAR_MASSA", "PERDER_PESO", "CONDICIONAMENTO_GERAL", "SAUDE_E_BEM_ESTAR", "OUTRO"];
const EXPERIENCES: ExperienceLevel[] = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];
const AVAILABILITIES: WeeklyAvailability[] = ["UM_A_DOIS_DIAS", "TRES_A_QUATRO_DIAS", "CINCO_OU_MAIS_DIAS"];

/// Programas para você (proposta 11): pública como a prévia do plano
/// (`/api/livre/previa`), só calcula a partir das respostas; nada é gravado.
/// `?modalidade=` repetido, uma por modalidade.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const objective = params.get("objetivo") as IndividualObjective;
  const experience = params.get("experiencia") as ExperienceLevel;
  const availability = params.get("dias") as WeeklyAvailability;
  if (!OBJECTIVES.includes(objective) || !EXPERIENCES.includes(experience) || !AVAILABILITIES.includes(availability)) {
    return Response.json({ error: "VALIDACAO", message: "Respostas inválidas." }, { status: 400 });
  }
  try {
    const modalities = parseModalities(params.getAll("modalidade"));
    return Response.json(await buildRecommendations({ modalities, objective, experience, availability }));
  } catch (error) {
    if (error instanceof ModalityError) return Response.json({ error: "VALIDACAO", message: error.message }, { status: 400 });
    throw error;
  }
}
