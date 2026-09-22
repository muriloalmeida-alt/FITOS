// @vitest-environment node
//
// Testes de integração do onboarding profissional do Personal (FIT-113)
// contra um PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { completePersonalOnboarding, getPersonalOnboardingProfile, OnboardingError } from "./onboarding";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.personalProfile.deleteMany({ where: { tenant: { owner: { email: { contains: run } } } } });
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createPersonalTenant(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({
    data: { ownerId: user.id, name: `Espaço de ${label}` },
  });
  return { user, tenant };
}

describe("completePersonalOnboarding (FIT-113)", () => {
  it("cria o perfil e atualiza Tenant.name a partir do nome do espaço informado", async () => {
    const { tenant } = await createPersonalTenant("novo");

    const profile = await completePersonalOnboarding(
      {
        tenantId: tenant.id,
        phone: "(11) 91234-5678",
        studentRangeEstimate: "COMECANDO_AGORA",
        businessName: "Estúdio Fulano",
        termsAccepted: true,
      },
      prisma
    );

    expect(profile.tenantId).toBe(tenant.id);
    expect(profile.phone).toBe("(11) 91234-5678");
    expect(profile.cref).toBeNull();
    expect(profile.termsAcceptedAt).toBeInstanceOf(Date);

    const updatedTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updatedTenant.name).toBe("Estúdio Fulano");
  });

  it("CREF é opcional; quando informado, é preservado", async () => {
    const { tenant } = await createPersonalTenant("com-cref");

    const profile = await completePersonalOnboarding(
      {
        tenantId: tenant.id,
        phone: "(11) 91234-5678",
        cref: "012345-G/SP",
        studentRangeEstimate: "ATE_20",
        businessName: "Espaço com CREF",
        termsAccepted: true,
      },
      prisma
    );

    expect(profile.cref).toBe("012345-G/SP");
  });

  it("reabrir o onboarding atualiza o mesmo registro, nunca cria um segundo", async () => {
    const { tenant } = await createPersonalTenant("reaberto");

    await completePersonalOnboarding(
      { tenantId: tenant.id, phone: "(11) 91234-5678", studentRangeEstimate: "ATE_20", businessName: "Nome 1", termsAccepted: true },
      prisma
    );
    const updated = await completePersonalOnboarding(
      { tenantId: tenant.id, phone: "(21) 98888-7777", studentRangeEstimate: "MAIS_DE_50", businessName: "Nome 2", termsAccepted: true },
      prisma
    );

    expect(updated.studentRangeEstimate).toBe("MAIS_DE_50");
    const count = await prisma.personalProfile.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(1);
    const updatedTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updatedTenant.name).toBe("Nome 2");
  });

  it("rejeita celular inválido, sem gravar nem atualizar o tenant", async () => {
    const { tenant } = await createPersonalTenant("celular-invalido");

    await expect(
      completePersonalOnboarding(
        { tenantId: tenant.id, phone: "123", studentRangeEstimate: "ATE_20", businessName: "Nome", termsAccepted: true },
        prisma
      )
    ).rejects.toBeInstanceOf(OnboardingError);

    expect(await getPersonalOnboardingProfile(tenant.id, prisma)).toBeNull();
  });

  it("rejeita sem aceite dos termos", async () => {
    const { tenant } = await createPersonalTenant("sem-termos");

    await expect(
      completePersonalOnboarding(
        { tenantId: tenant.id, phone: "(11) 91234-5678", studentRangeEstimate: "ATE_20", businessName: "Nome", termsAccepted: false },
        prisma
      )
    ).rejects.toBeInstanceOf(OnboardingError);
  });

  it("rejeita nome do espaço vazio", async () => {
    const { tenant } = await createPersonalTenant("nome-vazio");

    await expect(
      completePersonalOnboarding(
        { tenantId: tenant.id, phone: "(11) 91234-5678", studentRangeEstimate: "ATE_20", businessName: "   ", termsAccepted: true },
        prisma
      )
    ).rejects.toBeInstanceOf(OnboardingError);
  });

  it("getPersonalOnboardingProfile retorna null quando o onboarding nunca foi concluído", async () => {
    const { tenant } = await createPersonalTenant("sem-onboarding");

    expect(await getPersonalOnboardingProfile(tenant.id, prisma)).toBeNull();
  });
});
