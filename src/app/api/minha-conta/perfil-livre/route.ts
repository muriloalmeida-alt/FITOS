import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { OnboardingError, updateIndividualPreferences } from "@/modules/individual-onboarding/onboarding";

const optional = <T extends string>(value: unknown) => (typeof value === "string" ? (value as T) : undefined);

/// FIT-160: "Editar respostas" e nome do espaço do FitOS Livre — sempre
/// o tenant da sessão.
export async function PATCH(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    await updateIndividualPreferences({
      tenantId: ctx.tenantId,
      objective: optional<IndividualObjective>(body.objective),
      experienceLevel: optional<ExperienceLevel>(body.experienceLevel),
      weeklyAvailability: optional<WeeklyAvailability>(body.weeklyAvailability),
      spaceName: optional<string>(body.spaceName),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    throw error;
  }
}
