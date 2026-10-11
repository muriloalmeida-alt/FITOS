// @vitest-environment node
//
// Biblioteca pronta do FitOS Livre contra PostgreSQL real (banco de
// testes): o mesmo catálogo do personal, sem copiar nada para o espaço até
// o praticante usar um item.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { STARTER_LIBRARY } from "./starterLibrary";
import { copyReadyItem, getReadyLibrary } from "./readyLibrary";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
}, 60_000);

afterAll(async () => {
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function livre(label: string) {
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: "Rafa", role: "INDIVIDUAL" } });
  return prisma.tenant.create({ data: { ownerId: owner.id, name: `Livre ${label} ${run}` } });
}

describe("biblioteca pronta do FitOS Livre", () => {
  it("lista os mesmos programas, treinos e aeróbicos do personal, com conteúdo e duração", async () => {
    const library = await getReadyLibrary(prisma);
    expect(library.programs).toHaveLength(STARTER_LIBRARY.programs.length);
    expect(library.workouts.length + library.cardio.length).toBe(STARTER_LIBRARY.workouts.length + STARTER_LIBRARY.cardio.length);
    expect(new Set([...library.programs, ...library.workouts, ...library.cardio].map((entry) => entry.id)).size).toBe(library.programs.length + library.workouts.length + library.cardio.length);

    const program = library.programs.find((entry) => entry.name === "Divisão ABC · 60 min")!;
    expect(program.meta).toBe("2 treinos + 1 aeróbico · 8 semanas");
    expect(program.lines[0]).toEqual({ name: "Superiores · 60 min", dose: expect.stringMatching(/^seg e qui · \d+ exercícios$/) });

    const workout = library.workouts.find((entry) => entry.name === "Corpo todo express · 30 min") ?? library.workouts[0]!;
    expect(workout.minutes).toBeGreaterThan(0);
    expect(workout.lines.length).toBeGreaterThan(0);
    expect(library.cardio.every((entry) => entry.cardio)).toBe(true);
  });

  it("usar um treino cria a cópia nos treinos do praticante, sem mexer nos outros", async () => {
    const tenant = await livre("treino");
    const library = await getReadyLibrary(prisma);
    const first = await copyReadyItem({ tenantId: tenant.id, kind: "treino", key: library.workouts[0]!.id }, prisma);
    const second = await copyReadyItem({ tenantId: tenant.id, kind: "treino", key: library.cardio[0]!.id }, prisma);

    const workouts = await prisma.workout.findMany({ where: { tenantId: tenant.id }, include: { workoutExercises: true, trainingPlan: true } });
    expect(workouts.map((workout) => workout.id).sort()).toEqual([...first.workoutIds, ...second.workoutIds].sort());
    expect(workouts.every((workout) => workout.status === "ATIVO" && workout.trainingPlan.isDraftBucket)).toBe(true);
    const cardio = workouts.find((workout) => workout.id === second.workoutIds[0])!;
    expect(cardio.workoutExercises.every((item) => item.durationSeconds && item.intensity)).toBe(true);
  });

  it("começar um programa arquiva os treinos ativos e entra com os dias do programa", async () => {
    const tenant = await livre("programa");
    const library = await getReadyLibrary(prisma);
    const before = await copyReadyItem({ tenantId: tenant.id, kind: "treino", key: library.workouts[0]!.id }, prisma);
    const program = library.programs.find((entry) => entry.name === "Divisão ABC · 60 min")!;
    const result = await copyReadyItem({ tenantId: tenant.id, kind: "programa", key: program.id }, prisma);

    expect(result.workoutIds).toHaveLength(3);
    const active = await prisma.workout.findMany({ where: { tenantId: tenant.id, status: "ATIVO" }, orderBy: { position: "asc" } });
    expect(active.map((workout) => [workout.name, workout.suggestedDays])).toEqual([
      ["Superiores · 60 min", ["SEGUNDA", "QUINTA"]],
      ["Pernas completo · 60 min", ["TERCA", "SEXTA"]],
      ["Cardio misto · 60 min", ["QUARTA"]],
    ]);
    expect((await prisma.workout.findUniqueOrThrow({ where: { id: before.workoutIds[0]! } })).status).toBe("ARQUIVADO");
  });

  it("item desconhecido não cria nada", async () => {
    const tenant = await livre("desconhecido");
    await expect(copyReadyItem({ tenantId: tenant.id, kind: "programa", key: "nao-existe" }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    expect(await prisma.workout.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
