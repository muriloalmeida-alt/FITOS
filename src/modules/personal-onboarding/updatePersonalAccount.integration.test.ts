// @vitest-environment node
//
// FIT-149 (EPIC-19): edição do Perfil do Personal em sheets.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { OnboardingError, updatePersonalAccount } from "./onboarding";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.personalProfile.deleteMany({ where: { tenant: { owner: { email: { contains: run } } } } });
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("updatePersonalAccount (FIT-149)", () => {
  it("muda só os campos enviados, e CREF vazio limpa", async () => {
    const user = await prisma.user.create({ data: { email: `p-${run}@example.test`, name: "Joana", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: "Espaço antigo" } });
    await prisma.personalProfile.create({ data: { tenantId: tenant.id, phone: "11987654321", cref: "123456-G/SP", cpfCnpj: "11144477735", studentRangeEstimate: "ATE_20", termsAcceptedAt: new Date(2026, 0, 1) } });

    await updatePersonalAccount({ tenantId: tenant.id, userId: user.id, businessName: "  Studio Joana ", name: "Joana Lima" }, prisma);
    await updatePersonalAccount({ tenantId: tenant.id, userId: user.id, cref: "", studentRangeEstimate: "DE_21_A_50" }, prisma);

    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).name).toBe("Studio Joana");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("Joana Lima");
    expect(await prisma.personalProfile.findUniqueOrThrow({ where: { tenantId: tenant.id } })).toMatchObject({
      phone: "11987654321",
      cref: null,
      cpfCnpj: "11144477735",
      studentRangeEstimate: "DE_21_A_50",
      termsAcceptedAt: new Date(2026, 0, 1),
    });
  });

  it("valida antes de gravar", async () => {
    const user = await prisma.user.create({ data: { email: `v-${run}@example.test`, name: "Ana", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: "Espaço" } });
    await expect(updatePersonalAccount({ tenantId: tenant.id, userId: user.id, businessName: "Novo", phone: "1199" }, prisma)).rejects.toBeInstanceOf(OnboardingError);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).name).toBe("Espaço");
  });
});
