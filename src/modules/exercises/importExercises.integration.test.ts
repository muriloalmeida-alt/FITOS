// @vitest-environment node
//
// Testes de integração da importação do catálogo global (FIT-021) contra
// PostgreSQL real (banco de testes). `searchFn` é substituído por fixtures
// locais — nenhum destes testes toca a rede real ou a API Ninjas.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { buildExternalId, importGlobalExercises } from "./importExercises";
import type { ExerciseDTO } from "@/integrations/api-ninjas";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.$disconnect();
});

function dto(overrides: Partial<ExerciseDTO> = {}): ExerciseDTO {
  return {
    name: `Push-up ${run}`,
    type: "strength",
    muscle: "chest",
    equipments: null,
    difficulty: "beginner",
    instructions: "Lower your body...",
    safetyInfo: null,
    ...overrides,
  };
}

function searchFnReturning(...batches: ExerciseDTO[][]) {
  let call = 0;
  return async () => {
    const batch = batches[call] ?? [];
    call += 1;
    return batch;
  };
}

function searchFnFailingThenSucceeding(successBatch: ExerciseDTO[]) {
  let call = 0;
  return async () => {
    call += 1;
    if (call === 1) {
      throw new Error("falha simulada na API Ninjas");
    }
    return successBatch;
  };
}

describe("importGlobalExercises (FIT-021)", () => {
  it("importa um exercício novo: cria com tenantId nulo, origin API_NINJAS, contagens corretas", async () => {
    const item = dto({ name: `Agachamento ${run} A` });
    const searchFn = searchFnReturning([item]);

    const result = await importGlobalExercises([{ muscle: "quadriceps" }], prisma, searchFn as never);

    expect(result).toEqual({ received: 1, valid: 1, rejected: 0, created: 1, updated: 0, failedSearches: 0 });

    const stored = await prisma.exercise.findFirstOrThrow({ where: { name: item.name } });
    expect(stored.tenantId).toBeNull();
    expect(stored.origin).toBe("API_NINJAS");
    expect(stored.muscle).toBe("chest");
    expect(stored.externalId).toBe(buildExternalId(item));
  });

  it("reimportação do mesmo exercício: não duplica, atualiza os dados (idempotente)", async () => {
    const original = dto({ name: `Flexão ${run} B`, difficulty: "beginner" });
    const searchFn1 = searchFnReturning([original]);
    await importGlobalExercises([{ muscle: "chest" }], prisma, searchFn1 as never);

    const updated = dto({ name: `Flexão ${run} B`, difficulty: "advanced" });
    const searchFn2 = searchFnReturning([updated]);
    const secondResult = await importGlobalExercises([{ muscle: "chest" }], prisma, searchFn2 as never);

    expect(secondResult).toEqual({ received: 1, valid: 1, rejected: 0, created: 0, updated: 1, failedSearches: 0 });

    const rows = await prisma.exercise.findMany({ where: { name: updated.name } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.difficulty).toBe("advanced");
  });

  it("falha parcial: uma busca falha, outra sucede — registros da busca bem-sucedida são preservados", async () => {
    const item = dto({ name: `Remada ${run} C` });
    const searchFn = searchFnFailingThenSucceeding([item]);

    const result = await importGlobalExercises([{ muscle: "back" }, { muscle: "back" }], prisma, searchFn as never);

    expect(result.failedSearches).toBe(1);
    expect(result.created).toBe(1);

    const stored = await prisma.exercise.findFirst({ where: { name: item.name } });
    expect(stored).not.toBeNull();
  });

  it("resposta vazia: nenhum erro, contagens zeradas", async () => {
    const searchFn = searchFnReturning([]);

    const result = await importGlobalExercises([{ muscle: "obliques" }], prisma, searchFn as never);

    expect(result).toEqual({ received: 0, valid: 0, rejected: 0, created: 0, updated: 0, failedSearches: 0 });
  });

  it("duas importações concorrentes do mesmo exercício: exatamente uma cria, a outra atualiza — nunca duplica", async () => {
    const item = dto({ name: `Levantamento terra ${run} D` });
    const searchFnA = searchFnReturning([item]);
    const searchFnB = searchFnReturning([item]);

    const [resultA, resultB] = await Promise.all([
      importGlobalExercises([{ muscle: "back" }], prisma, searchFnA as never),
      importGlobalExercises([{ muscle: "back" }], prisma, searchFnB as never),
    ]);

    const outcomes = [resultA, resultB];
    const totalCreated = outcomes.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = outcomes.reduce((sum, r) => sum + r.updated, 0);
    expect(totalCreated).toBe(1);
    expect(totalUpdated).toBe(1);

    const rows = await prisma.exercise.findMany({ where: { name: item.name } });
    expect(rows).toHaveLength(1);
  });

  it("buildExternalId é determinístico e sensível a diferenças relevantes", () => {
    const a = dto({ name: `X ${run}`, muscle: "chest" });
    const b = dto({ name: `X ${run}`, muscle: "back" });

    expect(buildExternalId(a)).toBe(buildExternalId(a));
    expect(buildExternalId(a)).not.toBe(buildExternalId(b));
  });
});
