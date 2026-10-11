// @vitest-environment node
//
// FIT-160 (EPIC-21): editar respostas e nome do espaço do FitOS Livre.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { OnboardingError, updateIndividualPreferences } from "./onboarding";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.individualProfile.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("updateIndividualPreferences (FIT-160)", () => {
  it("muda só o que veio e valida antes de gravar", async () => {
    const user = await prisma.user.create({ data: { email: `l-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${run}`, type: "INDIVIDUAL" } });
    await prisma.individualProfile.create({ data: { tenantId: tenant.id, objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "UM_A_DOIS_DIAS", cpfCnpj: "11144477735" } });

    await updateIndividualPreferences({ tenantId: tenant.id, weeklyAvailability: "CINCO_OU_MAIS_DIAS", spaceName: `  Casa ${run} ` }, prisma);
    expect(await prisma.individualProfile.findUniqueOrThrow({ where: { tenantId: tenant.id } })).toMatchObject({ objective: "GANHAR_MASSA", weeklyAvailability: "CINCO_OU_MAIS_DIAS", cpfCnpj: "11144477735" });
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).name).toBe(`Casa ${run}`);

    await expect(updateIndividualPreferences({ tenantId: tenant.id, objective: "VOAR" as never, spaceName: "Outro" }, prisma)).rejects.toBeInstanceOf(OnboardingError);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } })).name).toBe(`Casa ${run}`);
  });
});
