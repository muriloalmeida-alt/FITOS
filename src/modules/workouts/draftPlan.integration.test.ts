// @vitest-environment node
//
// Plano rascunho do espaço: pedidos em paralelo (duplo clique no registro
// retroativo, treino avulso) devolvem o mesmo plano, sem erro de unicidade.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureDraftTrainingPlanForTenant } from "./workouts";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("ensureDraftTrainingPlanForTenant", () => {
  it("chamadas em paralelo criam um rascunho só e todas o recebem", async () => {
    const owner = await prisma.user.create({ data: { email: `livre-${run}@example.test`, name: "Livre", role: "INDIVIDUAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${run}`, type: "INDIVIDUAL" } });
    const plans = await Promise.all(Array.from({ length: 8 }, () => ensureDraftTrainingPlanForTenant(tenant.id, prisma)));
    expect(new Set(plans.map((plan) => plan.id)).size).toBe(1);
    expect(await prisma.trainingPlan.count({ where: { tenantId: tenant.id, isDraftBucket: true } })).toBe(1);
  });
});
