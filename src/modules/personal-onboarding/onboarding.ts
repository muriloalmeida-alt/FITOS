import "server-only";
import type { PersonalProfile, PersonalStudentRangeEstimate, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";
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

const VALID_STUDENT_RANGES: PersonalStudentRangeEstimate[] = ["COMECANDO_AGORA", "ATE_20", "DE_21_A_50", "MAIS_DE_50"];
const MAX_CREF_LENGTH = 20;
const MAX_BUSINESS_NAME_LENGTH = 80;

export interface CompletePersonalOnboardingInput {
  tenantId: string;
  /// Opcional desde a EPIC-33 (cadastro mínimo); validado se vier.
  phone?: string;
  cref?: string;
  /// Obrigatório (FIT-128, Issue #153) — exigido pelo Asaas em
  /// `POST /v3/customers` para a integração real de pagamento. `null` no
  /// banco existe só para perfis concluídos antes deste campo existir
  /// (ver comentário do campo em `schema.prisma`); toda nova submissão,
  /// inclusive reabrir um onboarding antigo, passa a exigi-lo.
  /// Opcional desde a EPIC-33: pedido junto com o cartão, perto do fim do
  /// teste. Validado se vier.
  cpfCnpj?: string;
  studentRangeEstimate: PersonalStudentRangeEstimate;
  businessName: string;
  termsAccepted: boolean;
}

function assertValid(input: CompletePersonalOnboardingInput): void {
  if (input.phone !== undefined && !isValidBrazilianPhone(input.phone)) {
    throw new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD.");
  }
  if (input.cref !== undefined && input.cref.trim().length > MAX_CREF_LENGTH) {
    throw new OnboardingError("VALIDACAO", `O CREF deve ter no máximo ${MAX_CREF_LENGTH} caracteres.`);
  }
  if (input.cpfCnpj !== undefined && !isValidCpfCnpj(input.cpfCnpj)) {
    throw new OnboardingError("VALIDACAO", "Informe um CPF ou CNPJ válido.");
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
        phone: input.phone ?? null,
        cref: cref || null,
        cpfCnpj: input.cpfCnpj ?? null,
        studentRangeEstimate: input.studentRangeEstimate,
        termsAcceptedAt: new Date(),
      },
      update: {
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.cref !== undefined ? { cref: cref || null } : {}),
        ...(input.cpfCnpj !== undefined ? { cpfCnpj: input.cpfCnpj } : {}),
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

export interface UpdatePersonalAccountInput {
  tenantId: string;
  userId: string;
  businessName?: string;
  phone?: string;
  /// `""` limpa o CREF (é opcional).
  cref?: string;
  studentRangeEstimate?: PersonalStudentRangeEstimate;
  name?: string;
}

const MAX_NAME_LENGTH = 120;

/// Edição do Perfil do Personal em sheets (FIT-149): nome do espaço,
/// perfil profissional e nome da pessoa. Só os campos enviados mudam;
/// CPF/CNPJ e o aceite dos termos ficam como estão (não são editados aqui).
export async function updatePersonalAccount(input: UpdatePersonalAccountInput, client: PrismaClient = prisma): Promise<void> {
  if (input.businessName !== undefined) {
    const name = input.businessName.trim();
    if (name.length === 0) throw new OnboardingError("VALIDACAO", "Informe o nome do seu espaço/negócio.");
    if (name.length > MAX_BUSINESS_NAME_LENGTH) throw new OnboardingError("VALIDACAO", `O nome do espaço deve ter no máximo ${MAX_BUSINESS_NAME_LENGTH} caracteres.`);
  }
  if (input.phone !== undefined && !isValidBrazilianPhone(input.phone)) {
    throw new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD.");
  }
  if (input.cref !== undefined && input.cref.trim().length > MAX_CREF_LENGTH) {
    throw new OnboardingError("VALIDACAO", `O CREF deve ter no máximo ${MAX_CREF_LENGTH} caracteres.`);
  }
  if (input.studentRangeEstimate !== undefined && !VALID_STUDENT_RANGES.includes(input.studentRangeEstimate)) {
    throw new OnboardingError("VALIDACAO", "Faixa de alunos inválida.");
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0) throw new OnboardingError("VALIDACAO", "Informe seu nome.");
    if (name.length > MAX_NAME_LENGTH) throw new OnboardingError("VALIDACAO", `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }

  const profileData = {
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.cref !== undefined ? { cref: input.cref.trim() || null } : {}),
    ...(input.studentRangeEstimate !== undefined ? { studentRangeEstimate: input.studentRangeEstimate } : {}),
  };
  await client.$transaction(async (tx) => {
    if (input.businessName !== undefined) await tx.tenant.update({ where: { id: input.tenantId }, data: { name: input.businessName.trim() } });
    if (Object.keys(profileData).length > 0) {
      const updated = await tx.personalProfile.updateMany({ where: { tenantId: input.tenantId }, data: profileData });
      if (updated.count === 0) throw new OnboardingError("VALIDACAO", "Conclua o cadastro profissional antes de editar.");
    }
    if (input.name !== undefined) await tx.user.update({ where: { id: input.userId }, data: { name: input.name.trim() } });
  });
}
