// @vitest-environment node
//
// Testes de integração do catálogo de planos comerciais (FIT-090) contra
// PostgreSQL real.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getPlanVersionById, getSellablePlan, listSellablePlans, publishPlanVersion, PlanError } from "./plans";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `teste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeEach(async () => {
  await prisma.commercialPlan.deleteMany({ where: { code: { contains: run } } });
});

afterAll(async () => {
  await prisma.commercialPlan.deleteMany({ where: { code: { contains: run } } });
  await prisma.$disconnect();
});

describe("publishPlanVersion (FIT-090)", () => {
  it("cria a versão 1, ativa, quando nenhuma versão existe para o código/ciclo", async () => {
    const plan = await publishPlanVersion(
      { code: `essencial-${run}`, name: "Essencial", billingCycle: "MENSAL", priceCents: 3990, studentLimit: 15 },
      prisma
    );

    expect(plan.version).toBe(1);
    expect(plan.active).toBe(true);
    expect(plan.currency).toBe("BRL");
    expect(plan.trialDays).toBe(0);
    expect(plan.effectiveTo).toBeNull();
  });

  it("republicar desativa a versão anterior (sem editar seus dados) e cria a versão 2", async () => {
    const code = `profissional-${run}`;
    const v1 = await publishPlanVersion(
      { code, name: "Profissional", billingCycle: "MENSAL", priceCents: 7990, studentLimit: 50 },
      prisma
    );

    const v2 = await publishPlanVersion(
      { code, name: "Profissional", billingCycle: "MENSAL", priceCents: 8990, studentLimit: 60 },
      prisma
    );

    expect(v2.version).toBe(2);
    expect(v2.active).toBe(true);

    const v1Reloaded = await getPlanVersionById(v1.id, prisma);
    expect(v1Reloaded?.active).toBe(false);
    expect(v1Reloaded?.effectiveTo).not.toBeNull();
    expect(v1Reloaded?.priceCents).toBe(7990);
    expect(v1Reloaded?.studentLimit).toBe(50);
  });

  // Não testado via duas chamadas reais de `publishPlanVersion` em
  // `Promise.allSettled`: republicar não é um erro (é o fluxo normal de
  // versionamento) — só é uma trava de concorrência de verdade quando as
  // duas leituras de "versão ativa atual" acontecem antes de qualquer
  // escrita comprometer, algo que depende de timing real e não é
  // determinístico de forjar em teste. O que importa (e é determinístico
  // de testar) é a garantia física: o índice único parcial da migration
  // rejeita duas linhas `active: true` para o mesmo `(code, billingCycle)`,
  // mesmo passando por fora de `publishPlanVersion`.
  it("índice único parcial da migration rejeita duas linhas active=true para o mesmo código/ciclo", async () => {
    const code = `indice-${run}`;
    const data = { code, name: "Teste", billingCycle: "ANUAL" as const, priceCents: 1000, studentLimit: 10, version: 1 };

    await prisma.commercialPlan.create({ data });

    await expect(prisma.commercialPlan.create({ data: { ...data, version: 2 } })).rejects.toMatchObject({ code: "P2002" });
  });

  it.each([
    { priceCents: 0 },
    { priceCents: -100 },
    { studentLimit: 0 },
    { trialDays: -1 },
    { discountPercent: 101 },
    { discountPercent: -1 },
  ])("rejeita entrada inválida %o", async (overrides) => {
    await expect(
      publishPlanVersion(
        { code: `invalido-${run}`, name: "X", billingCycle: "MENSAL", priceCents: 100, studentLimit: 10, ...overrides },
        prisma
      )
    ).rejects.toBeInstanceOf(PlanError);
  });

  it("rejeita código e nome vazios", async () => {
    await expect(
      publishPlanVersion({ code: "   ", name: "X", billingCycle: "MENSAL", priceCents: 100, studentLimit: 10 }, prisma)
    ).rejects.toBeInstanceOf(PlanError);
    await expect(
      publishPlanVersion({ code: `nome-vazio-${run}`, name: "  ", billingCycle: "MENSAL", priceCents: 100, studentLimit: 10 }, prisma)
    ).rejects.toBeInstanceOf(PlanError);
  });
});

describe("listSellablePlans / getSellablePlan (FIT-090)", () => {
  it("lista só versões ativas — republicar remove a anterior da listagem vendável", async () => {
    const code = `listagem-${run}`;
    await publishPlanVersion({ code, name: "Listagem", billingCycle: "MENSAL", priceCents: 100, studentLimit: 5 }, prisma);
    const v2 = await publishPlanVersion({ code, name: "Listagem", billingCycle: "MENSAL", priceCents: 200, studentLimit: 5 }, prisma);

    const sellable = await listSellablePlans(prisma);
    const matching = sellable.filter((p) => p.code === code);

    expect(matching).toHaveLength(1);
    expect(matching[0]?.id).toBe(v2.id);
  });

  it("getSellablePlan retorna null para código/ciclo sem versão ativa", async () => {
    const plan = await getSellablePlan(`inexistente-${run}`, "MENSAL", prisma);
    expect(plan).toBeNull();
  });
});
