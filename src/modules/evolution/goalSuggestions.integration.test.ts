// @vitest-environment node
//
// Metas sugeridas (EPIC-30) contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { suggestGoals } from "./goalSuggestions";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.assessment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("suggestGoals (EPIC-30)", () => {
  it("parte do último peso; sem treinos, sem meta de carga", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Dono", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${run}`, type: "INDIVIDUAL" } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `aluno-${run}@example.test`, displayName: "Aluno" } });
    await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: student.id, authorUserId: owner.id, weightGrams: 81200 } });

    const suggestions = await suggestGoals({ tenantId: tenant.id, studentId: student.id }, prisma);
    expect(suggestions.map((s) => s.key)).toEqual(["peso", "frequencia"]);
    expect(suggestions[0]!.why).toContain("Hoje: 81,2 kg");
    expect(suggestions[1]).toMatchObject({ value: 2, why: "Comece com uma rotina que caiba na semana" });
  });
});
