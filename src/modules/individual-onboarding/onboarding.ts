import "server-only";
import type { ExperienceLevel, IndividualObjective, IndividualProfile, PrismaClient, WeeklyAvailability } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isValidCpfCnpj } from "@/shared/lib/cpfCnpj";

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
  /// Obrigatório (FIT-128, Issue #153) — exigido pelo Asaas em
  /// `POST /v3/customers` para a integração real de pagamento do plano
  /// pago do FitOS Livre. `null` no banco existe só para perfis
  /// concluídos antes deste campo existir; toda nova submissão, inclusive
  /// reabrir um onboarding antigo, passa a exigi-lo.
  cpfCnpj: string;
  termsAccepted: boolean;
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
  if (!isValidCpfCnpj(input.cpfCnpj)) {
    throw new OnboardingError("VALIDACAO", "Informe um CPF ou CNPJ válido.");
  }
}

/// Grava a configuração inicial do onboarding "Treino sozinho" (FIT-101).
/// Idempotente por construção (`tenantId @unique`): reabrir o onboarding
/// (ex.: o usuário volta e muda de ideia sobre o objetivo) sempre
/// atualiza o mesmo registro via upsert, nunca cria um segundo — não há
/// "histórico de onboarding" nesta História, apenas a configuração atual.
///
/// `termsAccepted` só é exigido na primeira conclusão (`FIT-119`) — uma
/// vez aceito, reabrir o onboarding para ajustar objetivo/experiência/
/// disponibilidade nunca pede um novo aceite nem sobrescreve
/// `termsAcceptedAt` (mesmo princípio de "preserva o momento original" já
/// usado em `endStudentBond`/`softDeleteAssessment`).
export async function completeIndividualOnboarding(
  input: CompleteIndividualOnboardingInput,
  client: PrismaClient = prisma
): Promise<IndividualProfile> {
  assertValid(input);

  const existing = await client.individualProfile.findUnique({ where: { tenantId: input.tenantId } });
  if (!existing && !input.termsAccepted) {
    throw new OnboardingError("VALIDACAO", "É necessário aceitar os termos para continuar.");
  }

  return client.individualProfile.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      objective: input.objective,
      experienceLevel: input.experienceLevel,
      weeklyAvailability: input.weeklyAvailability,
      cpfCnpj: input.cpfCnpj,
      termsAcceptedAt: new Date(),
    },
    update: {
      objective: input.objective,
      experienceLevel: input.experienceLevel,
      weeklyAvailability: input.weeklyAvailability,
      cpfCnpj: input.cpfCnpj,
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

const MAX_SPACE_NAME_LENGTH = 80;

/// Perfil do FitOS Livre (FIT-160): "Editar respostas" (objetivo,
/// experiência e disponibilidade) e o nome do espaço. Só os campos
/// enviados mudam; CPF/CNPJ e o aceite dos termos ficam como estão.
export async function updateIndividualPreferences(
  input: { tenantId: string; objective?: IndividualObjective; experienceLevel?: ExperienceLevel; weeklyAvailability?: WeeklyAvailability; spaceName?: string },
  client: PrismaClient = prisma
): Promise<void> {
  if (input.objective !== undefined && !VALID_OBJECTIVES.includes(input.objective)) throw new OnboardingError("VALIDACAO", "Objetivo inválido.");
  if (input.experienceLevel !== undefined && !VALID_EXPERIENCE_LEVELS.includes(input.experienceLevel)) throw new OnboardingError("VALIDACAO", "Experiência inválida.");
  if (input.weeklyAvailability !== undefined && !VALID_AVAILABILITIES.includes(input.weeklyAvailability)) throw new OnboardingError("VALIDACAO", "Disponibilidade inválida.");
  const spaceName = input.spaceName?.trim();
  if (input.spaceName !== undefined && (!spaceName || spaceName.length > MAX_SPACE_NAME_LENGTH)) throw new OnboardingError("VALIDACAO", "Informe o nome do seu espaço.");

  const data = {
    ...(input.objective !== undefined ? { objective: input.objective } : {}),
    ...(input.experienceLevel !== undefined ? { experienceLevel: input.experienceLevel } : {}),
    ...(input.weeklyAvailability !== undefined ? { weeklyAvailability: input.weeklyAvailability } : {}),
  };
  await client.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      const updated = await tx.individualProfile.updateMany({ where: { tenantId: input.tenantId }, data });
      if (updated.count === 0) throw new OnboardingError("VALIDACAO", "Conclua o seu perfil antes de editar.");
    }
    if (spaceName) await tx.tenant.update({ where: { id: input.tenantId }, data: { name: spaceName } });
  });
}
