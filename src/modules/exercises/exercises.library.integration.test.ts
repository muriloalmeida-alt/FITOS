// @vitest-environment node
//
// FIT-147 (EPIC-19): biblioteca de exercícios — filtro por origem, opções
// dos filtros e "Criar uma versão minha" (BK-08). PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { archiveExercise, copyCatalogExerciseAsOwn, createOwnExercise, listCatalogExercises, listCatalogFacets } from "./exercises";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: label, role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

describe("biblioteca de exercícios (FIT-147)", () => {
  it("origem 'meus' mostra os próprios inclusive arquivados; 'biblioteca' só globais", async () => {
    const { owner, tenant } = await createTenant("orig");
    const global = await prisma.exercise.create({ data: { tenantId: null, origin: "FITOS_CURATED", name: `Global orig ${run}`, muscle: `Musc ${run}` } });
    const mine = await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: `Meu orig ${run}` }, prisma);
    const archived = await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: `Meu velho ${run}` }, prisma);
    await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: archived.id }, prisma);

    const meus = await listCatalogExercises({ tenantId: tenant.id, origin: "meus", search: run }, prisma);
    expect(meus.items.map((e) => e.id).sort()).toEqual([mine.id, archived.id].sort());
    const biblioteca = await listCatalogExercises({ tenantId: tenant.id, origin: "biblioteca", search: run }, prisma);
    expect(biblioteca.items.map((e) => e.id)).toEqual([global.id]);
    const todos = await listCatalogExercises({ tenantId: tenant.id, search: run }, prisma);
    expect(todos.items.map((e) => e.id).sort()).toEqual([global.id, mine.id].sort());

    const facets = await listCatalogFacets({ tenantId: tenant.id }, prisma);
    expect(facets.muscles).toContain(`Musc ${run}`);
  });

  it("cria uma versão própria de um global, numerando se repetir, e nunca de outro tenant", async () => {
    const { owner, tenant } = await createTenant("copia");
    const { tenant: other } = await createTenant("copia-b");
    const global = await prisma.exercise.create({ data: { tenantId: null, origin: "FITOS_CURATED", name: `Supino ${run}`, muscle: "Peitoral", instructions: "Deite.", imageUrl: "/media/exercises/x.webp" } });

    const first = await copyCatalogExerciseAsOwn({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: global.id }, prisma);
    expect(first).toMatchObject({ tenantId: tenant.id, origin: "PERSONAL", name: `Supino ${run} (minha versão)`, muscle: "Peitoral", instructions: "Deite.", imageUrl: "/media/exercises/x.webp" });
    const second = await copyCatalogExerciseAsOwn({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: global.id }, prisma);
    expect(second.name).toBe(`Supino ${run} (minha versão) 2`);

    const foreignOwn = await prisma.exercise.create({ data: { tenantId: other.id, origin: "PERSONAL", name: `Alheio ${run}` } });
    await expect(copyCatalogExerciseAsOwn({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: foreignOwn.id }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(copyCatalogExerciseAsOwn({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: first.id }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
