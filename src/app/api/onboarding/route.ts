import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { completeIndividualOnboarding, getIndividualOnboardingProfile, OnboardingError } from "@/modules/individual-onboarding/onboarding";
import { SubscriptionError, subscribeTenantToPlan } from "@/modules/billing/subscriptions";
import { createStarterPlanForIndividual } from "@/modules/individual-onboarding/starterPlan";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { prisma } from "@/shared/db/prisma";

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
      (body.cpfCnpj !== undefined && typeof body.cpfCnpj !== "string") ||
      (body.termsAccepted !== undefined && typeof body.termsAccepted !== "boolean") ||
      (body.planId !== undefined && typeof body.planId !== "string")
    ) {
      return Response.json({ error: "VALIDACAO", message: "Informe objetivo, experiência e disponibilidade válidos." }, { status: 400 });
    }
    // EPIC-33: sem CPF e sem plano no cadastro — o teste grátis do plano do
    // Livre começa na hora; CPF e cartão vêm perto do fim do teste.
    const planId = (typeof body.planId === "string" && body.planId.trim()) || (await listActivePlansForAudience("INDIVIDUAL"))[0]?.id;
    if (!planId) {
      return Response.json({ error: "NAO_ENCONTRADO", message: "Nenhum plano disponível no momento." }, { status: 404 });
    }

    const profile = await completeIndividualOnboarding({
      tenantId: ctx.tenantId,
      objective: body.objective,
      experienceLevel: body.experienceLevel,
      weeklyAvailability: body.weeklyAvailability,
      cpfCnpj: typeof body.cpfCnpj === "string" && body.cpfCnpj.trim() ? body.cpfCnpj : undefined,
      // Os termos são aceitos ao criar a conta (FIT-164).
      termsAccepted: body.termsAccepted ?? true,
    });

    const existing = await prisma.saasSubscription.findUnique({ where: { tenantId: ctx.tenantId }, select: { planId: true } });
    if (!existing || existing.planId !== planId) {
      await subscribeTenantToPlan({ tenantId: ctx.tenantId, tenantType: "INDIVIDUAL", planId, actorUserId: ctx.userId });
    }

    // EPIC-30: as respostas viram o plano inicial (só num espaço vazio).
    const starter = await createStarterPlanForIndividual({
      tenantId: ctx.tenantId,
      objective: body.objective,
      availability: body.weeklyAvailability,
      experience: body.experienceLevel,
    });

    return Response.json({ ...profile, starterWorkouts: starter.created }, { status: 201 });
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
