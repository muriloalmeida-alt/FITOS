import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { completeIndividualOnboarding, getIndividualOnboardingProfile, OnboardingError } from "@/modules/individual-onboarding/onboarding";

const VALID_OBJECTIVES: IndividualObjective[] = [
  "GANHAR_MASSA",
  "PERDER_PESO",
  "CONDICIONAMENTO_GERAL",
  "SAUDE_E_BEM_ESTAR",
  "OUTRO",
];
const VALID_EXPERIENCE_LEVELS: ExperienceLevel[] = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];
const VALID_AVAILABILITIES: WeeklyAvailability[] = ["UM_A_DOIS_DIAS", "TRES_A_QUATRO_DIAS", "CINCO_OU_MAIS_DIAS"];

/// Estado atual do onboarding do workspace individual do usuário
/// autenticado (FIT-101). Restrito a `requireIndividual` — ignora
/// deliberadamente qualquer `tenantId` que um cliente tentasse enviar.
export async function GET() {
  try {
    const ctx = await requireIndividual();
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    return Response.json({ completed: profile !== null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Conclui (ou reabre) o onboarding do workspace individual do usuário
/// autenticado. Mesmo padrão de validação manual + `authErrorResponse` já
/// usado em `/api/students`.
export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (
      !body ||
      !VALID_OBJECTIVES.includes(body.objective) ||
      !VALID_EXPERIENCE_LEVELS.includes(body.experienceLevel) ||
      !VALID_AVAILABILITIES.includes(body.weeklyAvailability)
    ) {
      return Response.json(
        { error: "VALIDACAO", message: "Informe objetivo, experiência e disponibilidade válidos." },
        { status: 400 }
      );
    }

    const profile = await completeIndividualOnboarding({
      tenantId: ctx.tenantId,
      objective: body.objective,
      experienceLevel: body.experienceLevel,
      weeklyAvailability: body.weeklyAvailability,
    });
    return Response.json(profile, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
