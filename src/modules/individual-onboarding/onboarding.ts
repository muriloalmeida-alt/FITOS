import "server-only";
import type { ExperienceLevel, IndividualObjective, IndividualProfile, PrismaClient, WeeklyAvailability } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

export class OnboardingError extends Error {
  constructor(
    public readonly kind: "VALIDACAO",
    message: string
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

const VALID_OBJECTIVES: IndividualObjective[] = [
  "GANHAR_MASSA",
  "PERDER_PESO",
  "CONDICIONAMENTO_GERAL",
  "SAUDE_E_BEM_ESTAR",
  "OUTRO",
];
const VALID_EXPERIENCE_LEVELS: ExperienceLevel[] = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];
const VALID_AVAILABILITIES: WeeklyAvailability[] = ["UM_A_DOIS_DIAS", "TRES_A_QUATRO_DIAS", "CINCO_OU_MAIS_DIAS"];

export interface CompleteIndividualOnboardingInput {
  tenantId: string;
  objective: IndividualObjective;
  experienceLevel: ExperienceLevel;
  weeklyAvailability: WeeklyAvailability;
}

function assertValid(input: CompleteIndividualOnboardingInput): void {
  if (!VALID_OBJECTIVES.includes(input.objective)) {
    throw new OnboardingError("VALIDACAO", "Objetivo inválido.");
  }
  if (!VALID_EXPERIENCE_LEVELS.includes(input.experienceLevel)) {
    throw new OnboardingError("VALIDACAO", "Nível de experiência inválido.");
  }
  if (!VALID_AVAILABILITIES.includes(input.weeklyAvailability)) {
    throw new OnboardingError("VALIDACAO", "Disponibilidade semanal inválida.");
  }
}

/// Grava a configuração inicial do onboarding "Treino sozinho" (FIT-101).
/// Idempotente por construção (`tenantId @unique`): reabrir o onboarding
/// (ex.: o usuário volta e muda de ideia sobre o objetivo) sempre
/// atualiza o mesmo registro via upsert, nunca cria um segundo — não há
/// "histórico de onboarding" nesta História, apenas a configuração atual.
export async function completeIndividualOnboarding(
  input: CompleteIndividualOnboardingInput,
  client: PrismaClient = prisma
): Promise<IndividualProfile> {
  assertValid(input);

  return client.individualProfile.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      objective: input.objective,
      experienceLevel: input.experienceLevel,
      weeklyAvailability: input.weeklyAvailability,
    },
    update: {
      objective: input.objective,
      experienceLevel: input.experienceLevel,
      weeklyAvailability: input.weeklyAvailability,
    },
  });
}

/// `null` significa "ainda não completou o onboarding" — usado por
/// `/painel` para decidir se redireciona um usuário INDIVIDUAL para
/// `/onboarding` antes de mostrar qualquer conteúdo do workspace.
export async function getIndividualOnboardingProfile(
  tenantId: string,
  client: PrismaClient = prisma
): Promise<IndividualProfile | null> {
  return client.individualProfile.findUnique({ where: { tenantId } });
}
