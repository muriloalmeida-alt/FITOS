import "server-only";
import type { PersonalProfile, PersonalStudentRangeEstimate, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";

export class OnboardingError extends Error {
  constructor(
    public readonly kind: "VALIDACAO",
    message: string
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

const VALID_STUDENT_RANGES: PersonalStudentRangeEstimate[] = ["COMECANDO_AGORA", "ATE_20", "DE_21_A_50", "MAIS_DE_50"];
const MAX_CREF_LENGTH = 20;
const MAX_BUSINESS_NAME_LENGTH = 80;

export interface CompletePersonalOnboardingInput {
  tenantId: string;
  phone: string;
  cref?: string;
  studentRangeEstimate: PersonalStudentRangeEstimate;
  businessName: string;
  termsAccepted: boolean;
}

function assertValid(input: CompletePersonalOnboardingInput): void {
  if (!isValidBrazilianPhone(input.phone)) {
    throw new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD.");
  }
  if (input.cref !== undefined && input.cref.trim().length > MAX_CREF_LENGTH) {
    throw new OnboardingError("VALIDACAO", `O CREF deve ter no máximo ${MAX_CREF_LENGTH} caracteres.`);
  }
  if (!VALID_STUDENT_RANGES.includes(input.studentRangeEstimate)) {
    throw new OnboardingError("VALIDACAO", "Faixa de alunos inválida.");
  }
  if (input.businessName.trim().length === 0) {
    throw new OnboardingError("VALIDACAO", "Informe o nome do seu espaço/negócio.");
  }
  if (input.businessName.trim().length > MAX_BUSINESS_NAME_LENGTH) {
    throw new OnboardingError("VALIDACAO", `O nome do espaço deve ter no máximo ${MAX_BUSINESS_NAME_LENGTH} caracteres.`);
  }
  if (!input.termsAccepted) {
    throw new OnboardingError("VALIDACAO", "É necessário aceitar os termos para continuar.");
  }
}

/// Grava o perfil profissional do Personal (FIT-113) e, na mesma
/// transação, atualiza `Tenant.name` a partir do "nome do espaço/negócio"
/// informado na etapa 3 — nunca uma coluna duplicada só para isso
/// (`Tenant.name` já existe desde a FIT-010). Idempotente por construção
/// (`tenantId @unique`), mesmo padrão de `completeIndividualOnboarding`:
/// reabrir o onboarding sempre atualiza o mesmo registro, nunca cria um
/// segundo. `termsAcceptedAt` é sempre a data da submissão atual — aceitar
/// de novo (reabrir e submeter outra vez) atualiza o timestamp, nunca
/// preserva o original; não há necessidade de histórico de aceites nesta
/// História.
export async function completePersonalOnboarding(
  input: CompletePersonalOnboardingInput,
  client: PrismaClient = prisma
): Promise<PersonalProfile> {
  assertValid(input);

  const cref = input.cref?.trim();
  const [, profile] = await client.$transaction([
    client.tenant.update({ where: { id: input.tenantId }, data: { name: input.businessName.trim() } }),
    client.personalProfile.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        phone: input.phone,
        cref: cref || null,
        studentRangeEstimate: input.studentRangeEstimate,
        termsAcceptedAt: new Date(),
      },
      update: {
        phone: input.phone,
        cref: cref || null,
        studentRangeEstimate: input.studentRangeEstimate,
        termsAcceptedAt: new Date(),
      },
    }),
  ]);

  return profile;
}

/// `null` significa "onboarding ainda não concluído" — usado por
/// `/painel` para decidir se redireciona um PERSONAL para
/// `/onboarding-personal` antes de mostrar qualquer conteúdo do
/// workspace, mesmo padrão de `getIndividualOnboardingProfile`.
export async function getPersonalOnboardingProfile(
  tenantId: string,
  client: PrismaClient = prisma
): Promise<PersonalProfile | null> {
  return client.personalProfile.findUnique({ where: { tenantId } });
}
