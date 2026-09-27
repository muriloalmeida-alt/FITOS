// @vitest-environment node
//
// Testes de integração do catálogo de planos comerciais (FIT-122) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getPlanById, listActivePlansForAudience } from "./plans";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function createPlan(overrides: Partial<Parameters<typeof prisma.plan.create>[0]["data"]> & { slug: string }) {
  return prisma.plan.create({
    data: {
      audience: "PERSONAL",
      name: "Plano de teste",
      billingCycle: "MENSAL",
      ...overrides,
    },
  });
}

describe("listActivePlansForAudience (FIT-122)", () => {
  it("lista apenas planos ativos da audiência informada, ordenados por position", async () => {
    const segundo = await createPlan({ slug: `${run}-personal-b`, position: 2, name: "B" });
    const primeiro = await createPlan({ slug: `${run}-personal-a`, position: 1, name: "A" });
    await createPlan({ slug: `${run}-personal-inativo`, position: 0, name: "Inativo", active: false });
    await createPlan({ slug: `${run}-individual`, audience: "INDIVIDUAL", position: 1, name: "Individual" });

    const lista = await listActivePlansForAudience("PERSONAL", prisma);
    const daEste = lista.filter((p) => p.slug.includes(run));

    expect(daEste.map((p) => p.id)).toEqual([primeiro.id, segundo.id]);
  });

  it("nunca retorna plano de outra audiência", async () => {
    await createPlan({ slug: `${run}-so-individual`, audience: "INDIVIDUAL", name: "Só individual" });

    const lista = await listActivePlansForAudience("PERSONAL", prisma);

    expect(lista.some((p) => p.slug === `${run}-so-individual`)).toBe(false);
  });
});

describe("getPlanById (FIT-122)", () => {
  it("retorna o plano quando existe", async () => {
    const plano = await createPlan({ slug: `${run}-buscar` });

    const encontrado = await getPlanById(plano.id, prisma);

    expect(encontrado?.id).toBe(plano.id);
  });

  it("retorna null para um id inexistente", async () => {
    const encontrado = await getPlanById(`plano-inexistente-${run}`, prisma);

    expect(encontrado).toBeNull();
  });
});
