import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { completeIndividualOnboarding, getIndividualOnboardingProfile, OnboardingError } from "@/modules/individual-onboarding/onboarding";
import { SubscriptionError, subscribeTenantToPlan } from "@/modules/billing/subscriptions";

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
///
/// **Seleção de plano (FIT-126)**: `planId` é obrigatório, mesmo padrão do
/// onboarding do Personal — o pacote trata "escolha do produto/plano"
/// como uma etapa real do onboarding do FitOS Livre, nunca uma decisão
/// silenciosa. `subscribeTenantToPlan` roda depois do perfil salvo com
/// sucesso; `completeIndividualOnboarding` é idempotente, então uma nova
/// tentativa com um plano válido nunca duplica o perfil.
export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (
      !body ||
      !VALID_OBJECTIVES.includes(body.objective) ||
      !VALID_EXPERIENCE_LEVELS.includes(body.experienceLevel) ||
      !VALID_AVAILABILITIES.includes(body.weeklyAvailability) ||
      typeof body.cpfCnpj !== "string" ||
      typeof body.termsAccepted !== "boolean" ||
      typeof body.planId !== "string" ||
      body.planId.trim() === ""
    ) {
      return Response.json(
        { error: "VALIDACAO", message: "Informe objetivo, experiência, disponibilidade, CPF/CNPJ e um plano válidos." },
        { status: 400 }
      );
    }

    const profile = await completeIndividualOnboarding({
      tenantId: ctx.tenantId,
      objective: body.objective,
      experienceLevel: body.experienceLevel,
      weeklyAvailability: body.weeklyAvailability,
      cpfCnpj: body.cpfCnpj,
      termsAccepted: body.termsAccepted,
    });

    await subscribeTenantToPlan({
      tenantId: ctx.tenantId,
      tenantType: "INDIVIDUAL",
      planId: body.planId,
      actorUserId: ctx.userId,
    });

    return Response.json(profile, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    if (error instanceof SubscriptionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "VALIDACAO" ? 400 : 409;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
