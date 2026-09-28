// @vitest-environment node
//
// Testes de integração do catálogo oficial de planos comerciais (FIT-127)
// contra PostgreSQL real (banco de testes). `ensurePlanCatalog` nunca foi
// coberto por teste antes desta História — comportamento crítico (nunca
// sobrescrever preço de slug em uso) validado aqui pela primeira vez.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensurePlanCatalog, PLAN_CATALOG } from "./planCatalog";
import { listActivePlansForAudience } from "./plans";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

afterAll(async () => {
  await prisma.$disconnect();
});

describe("ensurePlanCatalog (FIT-127)", () => {
  it("cria/atualiza todos os slugs do catálogo, sem duplicar nem remover nenhum", async () => {
    const primeiraExecucao = await ensurePlanCatalog(prisma);
    const segundaExecucao = await ensurePlanCatalog(prisma);

    expect(primeiraExecucao).toHaveLength(PLAN_CATALOG.length);
    expect(segundaExecucao).toHaveLength(PLAN_CATALOG.length);
    expect(segundaExecucao.map((p) => p.id).sort()).toEqual(primeiraExecucao.map((p) => p.id).sort());
  });

  it("a geração 1 (preço zero) fica desativada — nunca some da tabela, nunca oferecida de novo", async () => {
    await ensurePlanCatalog(prisma);

    const geracao1 = ["personal-essencial", "personal-profissional", "personal-ilimitado", "individual-livre"];
    for (const slug of geracao1) {
      const plano = await prisma.plan.findUnique({ where: { slug } });
      expect(plano).not.toBeNull();
      expect(plano?.active).toBe(false);
      expect(plano?.priceCents).toBe(0);
    }
  });

  it("a geração 2 tem preços reais, ativa, com 30 dias de trial", async () => {
    await ensurePlanCatalog(prisma);

    const casos: Array<{ slug: string; priceCents: number; studentLimit: number | null }> = [
      { slug: "personal-20", priceCents: 4990, studentLimit: 20 },
      { slug: "personal-50", priceCents: 6990, studentLimit: 50 },
      { slug: "personal-ilimitado-v2", priceCents: 9990, studentLimit: null },
      { slug: "individual-livre-v2", priceCents: 1990, studentLimit: null },
    ];
    for (const caso of casos) {
      const plano = await prisma.plan.findUnique({ where: { slug: caso.slug } });
      expect(plano?.active).toBe(true);
      expect(plano?.priceCents).toBe(caso.priceCents);
      expect(plano?.trialDays).toBe(30);
      expect(plano?.studentLimit).toBe(caso.studentLimit);
    }
  });

  it("listActivePlansForAudience nunca retorna a geração 1 (desativada) — só a geração 2", async () => {
    await ensurePlanCatalog(prisma);

    // `arrayContaining`/`not.toContain`, nunca igualdade exata da lista
    // inteira: o banco de testes é compartilhado com outros arquivos de
    // teste (ex.: subscriptions.integration.test.ts) que criam seus
    // próprios planos `PERSONAL` ativos e rodam em paralelo — a lista
    // completa nunca é estável entre arquivos, só a ausência da geração 1.
    const personal = await listActivePlansForAudience("PERSONAL", prisma);
    const individual = await listActivePlansForAudience("INDIVIDUAL", prisma);
    const personalSlugs = personal.map((p) => p.slug);
    const individualSlugs = individual.map((p) => p.slug);

    expect(personalSlugs).toEqual(expect.arrayContaining(["personal-20", "personal-50", "personal-ilimitado-v2"]));
    expect(individualSlugs).toEqual(expect.arrayContaining(["individual-livre-v2"]));
    for (const slugGeracao1 of ["personal-essencial", "personal-profissional", "personal-ilimitado", "individual-livre"]) {
      expect(personalSlugs).not.toContain(slugGeracao1);
      expect(individualSlugs).not.toContain(slugGeracao1);
    }
  });

  it("rodar de novo não altera o preço de um slug já existente (idempotência de valor, não só de contagem)", async () => {
    await ensurePlanCatalog(prisma);
    const antes = await prisma.plan.findUnique({ where: { slug: "personal-20" } });

    await ensurePlanCatalog(prisma);
    const depois = await prisma.plan.findUnique({ where: { slug: "personal-20" } });

    expect(depois?.priceCents).toBe(antes?.priceCents);
    expect(depois?.id).toBe(antes?.id);
  });
});
