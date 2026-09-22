// @vitest-environment node
//
// Testes de integração do catálogo unificado (FIT-023) contra PostgreSQL
// real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  archiveExercise,
  createOwnExercise,
  getCatalogExerciseForTenant,
  listCatalogExercises,
  listCatalogExercisesForPicker,
} from "./exercises";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function createGlobalExercise(name: string, overrides: Partial<{ muscle: string; type: string; difficulty: string }> = {}) {
  return prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name, ...overrides } });
}

describe("listCatalogExercises (FIT-023)", () => {
  it("inclui exercícios globais ativos e próprios ativos do tenant; nunca a API Ninjas", async () => {
    const { owner, tenant } = await createTenant("listagem");
    const global = await createGlobalExercise(`Push-up global ${run}`);
    const own = await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: `Rosca própria ${run}` }, prisma);

    const result = await listCatalogExercises({ tenantId: tenant.id }, prisma);
    const ids = result.items.map((item) => item.id);

    expect(ids).toContain(global.id);
    expect(ids).toContain(own.id);
  });

  it("IMP-EX-002: inclui exercício global de origem FITOS_CURATED, não só API_NINJAS", async () => {
    const { tenant } = await createTenant("listagem-curated");
    const curated = await prisma.exercise.create({
      data: { tenantId: null, origin: "FITOS_CURATED", name: `Rosca curada ${run}` },
    });

    const result = await listCatalogExercises({ tenantId: tenant.id, search: `curada ${run}` }, prisma);

    expect(result.items.map((item) => item.id)).toContain(curated.id);
  });

  it("nunca inclui exercício próprio arquivado", async () => {
    const { owner, tenant } = await createTenant("arquivado-oculto");
    const own = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Extensora arquivada ${run}` },
      prisma
    );
    await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: own.id }, prisma);

    const result = await listCatalogExercises({ tenantId: tenant.id, search: `arquivada ${run}` }, prisma);
    expect(result.items.map((item) => item.id)).not.toContain(own.id);
  });

  it("nunca inclui exercício próprio de outro tenant", async () => {
    const tenantA = await createTenant("catalogo-cruzado-a");
    const tenantB = await createTenant("catalogo-cruzado-b");
    const ownB = await createOwnExercise(
      { tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, name: `Exclusivo B ${run}` },
      prisma
    );

    const result = await listCatalogExercises({ tenantId: tenantA.tenant.id, search: `Exclusivo B ${run}` }, prisma);
    expect(result.items.map((item) => item.id)).not.toContain(ownB.id);
  });

  it("busca por nome (case-insensitive) e filtro por músculo", async () => {
    const { tenant } = await createTenant("busca-filtro");
    const target = await createGlobalExercise(`Agachamento Búlgaro ${run}`, { muscle: "quadriceps" });
    await createGlobalExercise(`Remada curvada ${run}`, { muscle: "back" });

    const byName = await listCatalogExercises({ tenantId: tenant.id, search: `agachamento búlgaro ${run}` }, prisma);
    expect(byName.items.map((i) => i.id)).toEqual([target.id]);

    const byMuscle = await listCatalogExercises({ tenantId: tenant.id, search: run, muscle: "quadriceps" }, prisma);
    expect(byMuscle.items.map((i) => i.id)).toEqual([target.id]);
  });

  it("resposta vazia (nenhum resultado): lista vazia, sem erro", async () => {
    const { tenant } = await createTenant("vazio");
    const result = await listCatalogExercises({ tenantId: tenant.id, search: `inexistente-${run}` }, prisma);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("paginação estável: nenhum item repetido ou pulado entre páginas", async () => {
    const { tenant } = await createTenant("paginacao");
    const names = Array.from({ length: 5 }, (_, i) => `Exercício paginação ${run} ${i}`);
    for (const name of names) {
      await createGlobalExercise(name);
    }

    const page1 = await listCatalogExercises({ tenantId: tenant.id, search: `paginação ${run}`, page: 1, pageSize: 2 }, prisma);
    const page2 = await listCatalogExercises({ tenantId: tenant.id, search: `paginação ${run}`, page: 2, pageSize: 2 }, prisma);
    const page3 = await listCatalogExercises({ tenantId: tenant.id, search: `paginação ${run}`, page: 3, pageSize: 2 }, prisma);

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((i) => i.id);
    expect(allIds).toHaveLength(5);
    expect(new Set(allIds).size).toBe(5);
    expect(page1.total).toBe(5);
  });
});

describe("getCatalogExerciseForTenant (FIT-023)", () => {
  it("encontra um exercício global", async () => {
    const { tenant } = await createTenant("detalhe-global");
    const global = await createGlobalExercise(`Supino global ${run}`);

    const found = await getCatalogExerciseForTenant({ tenantId: tenant.id, exerciseId: global.id }, prisma);
    expect(found?.id).toBe(global.id);
  });

  it("encontra um exercício próprio arquivado (para permitir reativação a partir do detalhe)", async () => {
    const { owner, tenant } = await createTenant("detalhe-arquivado");
    const own = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Panturrilha detalhe ${run}` },
      prisma
    );
    await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: own.id }, prisma);

    const found = await getCatalogExerciseForTenant({ tenantId: tenant.id, exerciseId: own.id }, prisma);
    expect(found?.status).toBe("ARQUIVADO");
  });

  it("nunca encontra exercício próprio de outro tenant", async () => {
    const tenantA = await createTenant("detalhe-cruzado-a");
    const tenantB = await createTenant("detalhe-cruzado-b");
    const ownB = await createOwnExercise(
      { tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, name: `Só de B ${run}` },
      prisma
    );

    const found = await getCatalogExerciseForTenant({ tenantId: tenantA.tenant.id, exerciseId: ownB.id }, prisma);
    expect(found).toBeNull();
  });

  it("id inexistente: null", async () => {
    const { tenant } = await createTenant("detalhe-inexistente");
    const found = await getCatalogExerciseForTenant({ tenantId: tenant.id, exerciseId: "id-que-nao-existe" }, prisma);
    expect(found).toBeNull();
  });
});

describe("listCatalogExercisesForPicker (correção pós-IMP-EX-002: seletor de exercício nunca paginado)", () => {
  it("retorna mais de 100 itens quando o catálogo visível ao tenant tem mais de 100 — nunca limitado como listCatalogExercises", async () => {
    const { owner, tenant } = await createTenant("picker-sem-limite");
    const names = Array.from({ length: 105 }, (_, i) => `Picker sem limite ${run} ${String(i).padStart(3, "0")}`);
    await Promise.all(names.map((name) => createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name }, prisma)));

    const result = await listCatalogExercisesForPicker({ tenantId: tenant.id }, prisma);

    const matching = result.filter((item) => item.name.startsWith(`Picker sem limite ${run}`));
    expect(matching).toHaveLength(105);
  });

  it("inclui o músculo do exercício", async () => {
    const { tenant } = await createTenant("picker-musculo");
    const global = await createGlobalExercise(`Rosca picker ${run}`, { muscle: "biceps" });

    const result = await listCatalogExercisesForPicker({ tenantId: tenant.id }, prisma);
    expect(result.find((item) => item.id === global.id)?.muscle).toBe("biceps");
  });

  it("nunca inclui exercício arquivado", async () => {
    const { owner, tenant } = await createTenant("picker-arquivado");
    const own = await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: `Picker arquivado ${run}` }, prisma);
    await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: own.id }, prisma);

    const result = await listCatalogExercisesForPicker({ tenantId: tenant.id }, prisma);
    expect(result.map((item) => item.id)).not.toContain(own.id);
  });

  it("nunca inclui exercício próprio de outro tenant", async () => {
    const tenantA = await createTenant("picker-cruzado-a");
    const tenantB = await createTenant("picker-cruzado-b");
    const ownB = await createOwnExercise(
      { tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, name: `Picker só de B ${run}` },
      prisma
    );

    const result = await listCatalogExercisesForPicker({ tenantId: tenantA.tenant.id }, prisma);
    expect(result.map((item) => item.id)).not.toContain(ownB.id);
  });

  it("inclui exercício global de origem FITOS_CURATED, não só API_NINJAS", async () => {
    const { tenant } = await createTenant("picker-curated");
    const curated = await prisma.exercise.create({ data: { tenantId: null, origin: "FITOS_CURATED", name: `Picker curado ${run}` } });

    const result = await listCatalogExercisesForPicker({ tenantId: tenant.id }, prisma);
    expect(result.map((item) => item.id)).toContain(curated.id);
  });
});
