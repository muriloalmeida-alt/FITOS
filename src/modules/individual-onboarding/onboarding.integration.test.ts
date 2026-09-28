// @vitest-environment node
//
// Testes de integração do onboarding "Treino sozinho" (FIT-101) contra um
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { completeIndividualOnboarding, getIndividualOnboardingProfile, OnboardingError } from "./onboarding";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
/// CPF de teste matematicamente válido, publicamente conhecido e usado em
/// tutoriais/testes de validação de CPF — nunca um documento real.
const VALID_CPF = "111.444.777-35";

afterAll(async () => {
  await prisma.individualProfile.deleteMany({ where: { tenant: { owner: { email: { contains: run } } } } });
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createIndividualTenant(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "INDIVIDUAL" },
  });
  const tenant = await prisma.tenant.create({
    data: { ownerId: user.id, name: `Workspace ${label}`, type: "INDIVIDUAL" },
  });
  return { user, tenant };
}

describe("completeIndividualOnboarding (FIT-101)", () => {
  it("cria o perfil de onboarding quando ainda não existe", async () => {
    const { tenant } = await createIndividualTenant("novo");

    const profile = await completeIndividualOnboarding(
      {
        tenantId: tenant.id,
        objective: "GANHAR_MASSA",
        experienceLevel: "INICIANTE",
        weeklyAvailability: "TRES_A_QUATRO_DIAS",
        cpfCnpj: VALID_CPF,
        termsAccepted: true,
      },
      prisma
    );

    expect(profile.tenantId).toBe(tenant.id);
    expect(profile.objective).toBe("GANHAR_MASSA");
    expect(profile.cpfCnpj).toBe(VALID_CPF);
    expect(profile.termsAcceptedAt).not.toBeNull();

    const stored = await getIndividualOnboardingProfile(tenant.id, prisma);
    expect(stored?.id).toBe(profile.id);
  });

  it("rejeita a primeira conclusão sem aceitar os termos (FIT-119)", async () => {
    const { tenant } = await createIndividualTenant("sem-termos");

    await expect(
      completeIndividualOnboarding(
        {
          tenantId: tenant.id,
          objective: "GANHAR_MASSA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "TRES_A_QUATRO_DIAS",
          cpfCnpj: VALID_CPF,
          termsAccepted: false,
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    expect(await getIndividualOnboardingProfile(tenant.id, prisma)).toBeNull();
  });

  it("rejeita CPF/CNPJ inválido, sem gravar nada", async () => {
    const { tenant } = await createIndividualTenant("cpf-invalido");

    await expect(
      completeIndividualOnboarding(
        {
          tenantId: tenant.id,
          objective: "GANHAR_MASSA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "TRES_A_QUATRO_DIAS",
          cpfCnpj: "111.444.777-36",
          termsAccepted: true,
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    expect(await getIndividualOnboardingProfile(tenant.id, prisma)).toBeNull();
  });

  it("reabrir o onboarding atualiza o mesmo registro, nunca cria um segundo, e nunca sobrescreve termsAcceptedAt (FIT-119)", async () => {
    const { tenant } = await createIndividualTenant("reaberto");

    const first = await completeIndividualOnboarding(
      {
        tenantId: tenant.id,
        objective: "PERDER_PESO",
        experienceLevel: "AVANCADO",
        weeklyAvailability: "UM_A_DOIS_DIAS",
        cpfCnpj: VALID_CPF,
        termsAccepted: true,
      },
      prisma
    );
    const updated = await completeIndividualOnboarding(
      {
        tenantId: tenant.id,
        objective: "SAUDE_E_BEM_ESTAR",
        experienceLevel: "INTERMEDIARIO",
        weeklyAvailability: "CINCO_OU_MAIS_DIAS",
        cpfCnpj: VALID_CPF,
        termsAccepted: false,
      },
      prisma
    );

    expect(updated.objective).toBe("SAUDE_E_BEM_ESTAR");
    expect(updated.termsAcceptedAt?.getTime()).toBe(first.termsAcceptedAt?.getTime());
    const count = await prisma.individualProfile.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(1);
  });

  it("rejeita objetivo fora do conjunto válido", async () => {
    const { tenant } = await createIndividualTenant("objetivo-invalido");

    await expect(
      completeIndividualOnboarding(
        {
          tenantId: tenant.id,
          // @ts-expect-error -- valor inválido deliberado para testar a validação
          objective: "QUALQUER_COISA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "UM_A_DOIS_DIAS",
          cpfCnpj: VALID_CPF,
          termsAccepted: true,
        },
        prisma
      )
    ).rejects.toBeInstanceOf(OnboardingError);

    expect(await getIndividualOnboardingProfile(tenant.id, prisma)).toBeNull();
  });

  it("getIndividualOnboardingProfile retorna null quando o onboarding nunca foi concluído", async () => {
    const { tenant } = await createIndividualTenant("sem-onboarding");

    expect(await getIndividualOnboardingProfile(tenant.id, prisma)).toBeNull();
  });
});
