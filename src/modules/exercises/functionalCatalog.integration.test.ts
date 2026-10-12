// @vitest-environment node
//
// Funcional e CrossFit (feature 1, etapa 1) contra PostgreSQL real: o
// catálogo da migração `funcional_catalogo` (56 exercícios, sem duplicar os
// que já existiam), o filtro por modalidade, o músculo secundário e a busca
// por nome alternativo sem acento.
import { afterAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createOwnExercise, listCatalogExercises, listCatalogExercisesForPicker, listCatalogFacets, updateOwnExercise } from "./exercises";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: label, role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

describe("catálogo Funcional e CrossFit", () => {
  it("56 exercícios: 22 Funcional e 34 CrossFit, cada um uma vez, com imagem e métrica", async () => {
    // Proposta 11 acrescentou dois (sem imagem) para os programas prontos.
    const PROGRAM_ONLY = ["fitos:agachamento-ate-o-banco", "fitos:remada-com-elastico"];
    const tagged = await prisma.exercise.findMany({ where: { origin: "FITOS_CURATED", categories: { isEmpty: false }, externalId: { notIn: PROGRAM_ONLY } }, select: { externalId: true, name: true, categories: true, imageUrl: true, metric: true } });
    expect(tagged).toHaveLength(56);
    expect(tagged.filter((e) => e.categories.includes("Funcional"))).toHaveLength(22);
    expect(tagged.filter((e) => e.categories.includes("CrossFit"))).toHaveLength(34);
    expect(new Set(tagged.map((e) => e.name.toLowerCase())).size).toBe(56);
    expect(tagged.every((e) => e.imageUrl && e.metric)).toBe(true);
    // As imagens novas são servidas de public/.
    for (const local of tagged.filter((e) => e.imageUrl!.startsWith("/media/"))) {
      expect(existsSync(path.join(process.cwd(), "public", local.imageUrl!))).toBe(true);
    }
    // Os que já existiam não foram duplicados: o terra convencional é o deadlift.
    expect(await prisma.exercise.count({ where: { origin: "FITOS_CURATED", externalId: { in: ["fitos:deadlift", "fitos:burpee", "fitos:goblet-squat"] } } })).toBe(0);
    const added = await prisma.exercise.findMany({ where: { origin: "FITOS_CURATED", externalId: { in: PROGRAM_ONLY } }, select: { categories: true, metric: true } });
    expect(added).toEqual([{ categories: ["Funcional"], metric: "REPS" }, { categories: ["Funcional"], metric: "REPS" }]);
  });

  it("filtra por modalidade, acha por nome alternativo sem acento e por músculo secundário", async () => {
    const { tenant } = await createTenant("busca");
    const crossfit = await listCatalogExercises({ tenantId: tenant.id, category: "CrossFit", pageSize: 100 }, prisma);
    expect(crossfit.total).toBe(34);

    const c2b = await listCatalogExercises({ tenantId: tenant.id, search: "c2b" }, prisma);
    expect(c2b.items.map((e) => e.name)).toEqual(["Chest-to-bar"]);
    const terra = await listCatalogExercises({ tenantId: tenant.id, search: "DEADLIFT", category: "CrossFit" }, prisma);
    expect(terra.items.map((e) => e.name)).toContain("Levantamento terra convencional");
    const semAcento = await listCatalogExercises({ tenantId: tenant.id, search: "avanco alternado" }, prisma);
    expect(semAcento.items.map((e) => e.name)).toEqual(["Avanço alternado"]);

    // Thruster tem Tríceps como secundário: aparece no filtro de Tríceps.
    const triceps = await listCatalogExercises({ tenantId: tenant.id, muscle: "Tríceps", category: "CrossFit", pageSize: 100 }, prisma);
    expect(triceps.items.map((e) => e.name)).toContain("Thruster");

    const facets = await listCatalogFacets({ tenantId: tenant.id }, prisma);
    expect(facets.categories.sort()).toEqual(["CrossFit", "Funcional"]);
    expect(facets.muscles).toContain("Adutores");

    const picker = await listCatalogExercisesForPicker({ tenantId: tenant.id }, prisma);
    expect(picker.find((e) => e.name === "Thruster")).toMatchObject({ categories: ["CrossFit"], secondaryMuscles: expect.arrayContaining(["Tríceps"]) });
  });

  it("exercício próprio entra na busca sem acento e acompanha a edição", async () => {
    const { owner, tenant } = await createTenant("proprio");
    const mine = await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: `Elevação pélvica ${run}`, muscle: "Glúteos" }, prisma);
    expect((await listCatalogExercises({ tenantId: tenant.id, origin: "meus", search: "elevacao pelvica" }, prisma)).items.map((e) => e.id)).toEqual([mine.id]);
    await updateOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: mine.id, name: `Hip thrust ${run}` }, prisma);
    expect((await listCatalogExercises({ tenantId: tenant.id, origin: "meus", search: "elevacao" }, prisma)).total).toBe(0);
    expect((await listCatalogExercises({ tenantId: tenant.id, origin: "meus", search: "gluteos" }, prisma)).items.map((e) => e.id)).toEqual([mine.id]);
  });
});
