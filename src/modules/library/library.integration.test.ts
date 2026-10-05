// @vitest-environment node
//
// EPIC-28: biblioteca inicial, aplicar a vários alunos e cópia do aluno
// versionada (ADR-016). PostgreSQL real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { listSwapOptions } from "@/modules/exercises/exercises";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { applyLibraryItem, getLibrary } from "./library";
import { getStudentCopy, restoreStudentCopy, reviseStudentCopy } from "./studentCopy";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
}, 60_000);

afterAll(async () => {
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" DISABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" DISABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" ENABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" ENABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}` } });
  const student = (name: string) => prisma.student.create({ data: { tenantId: tenant.id, email: `${name}-${label}-${run}@example.test`, displayName: name } });
  return { owner, tenant, pedro: await student("pedro"), ana: await student("ana") };
}

describe("biblioteca (EPIC-28)", () => {
  it("cria a biblioteca inicial uma única vez, com programas, treinos e aeróbicos", async () => {
    const f = await setup("inicial");
    const library = await getLibrary({ tenantId: f.tenant.id }, prisma);
    expect(library.programs.map((entry) => entry.name)).toEqual(["Emagrecimento 6 semanas", "Hipertrofia 8 semanas", "Iniciante corpo todo"]);
    expect(library.workouts.map((entry) => entry.name)).toContain("Inferiores A");
    expect(library.cardio.map((entry) => entry.name)).toEqual(["Caminhada inclinada", "Corrida intervalada", "Elíptico contínuo", "HIIT na bike"]);
    expect(library.cardio.find((entry) => entry.name === "HIIT na bike")?.meta).toBe("24 min · intervalado");
    expect(library.programs.find((entry) => entry.name === "Emagrecimento 6 semanas")?.meta).toBe("2 treinos + 2 aeróbicos · 6 semanas");
    expect(library.programs.find((entry) => entry.name === "Hipertrofia 8 semanas")?.lines[0]).toEqual({ name: "Inferiores A", dose: "seg · 5 exercícios" });

    await getLibrary({ tenantId: f.tenant.id }, prisma);
    expect(await prisma.trainingPlan.count({ where: { tenantId: f.tenant.id, isDraftBucket: false } })).toBe(3);
  });

  it("aplica programa a dois alunos (uma cópia para cada) e treino aeróbico como mais um treino", async () => {
    const f = await setup("aplicar");
    const library = await getLibrary({ tenantId: f.tenant.id }, prisma);
    const hipertrofia = library.programs.find((entry) => entry.name === "Hipertrofia 8 semanas")!;
    await applyLibraryItem({ tenantId: f.tenant.id, actorUserId: f.owner.id, kind: "programa", id: hipertrofia.id, studentIds: [f.pedro.id, f.ana.id] }, prisma);
    const pedro = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.pedro.id }, prisma))!;
    const ana = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.ana.id }, prisma))!;
    expect(pedro.planId).not.toBe(ana.planId);
    expect(pedro.workouts).toHaveLength(4);

    const hiit = library.cardio.find((entry) => entry.name === "HIIT na bike")!;
    await applyLibraryItem({ tenantId: f.tenant.id, actorUserId: f.owner.id, kind: "treino", id: hiit.id, studentIds: [f.pedro.id] }, prisma);
    const after = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.pedro.id }, prisma))!;
    expect(after.workouts.map((workout) => workout.name)).toEqual(["Inferiores A", "Superiores A", "Inferiores B", "Superiores B", "HIIT na bike"]);
    expect(after.workouts[4]!.items[0]).toMatchObject({ isCardio: true, durationSeconds: 24 * 60, intensity: "INTERVALADO" });
  });

  it("aluno sem programa: aplicar um treino cria um programa só com ele", async () => {
    const f = await setup("sem-programa");
    const library = await getLibrary({ tenantId: f.tenant.id }, prisma);
    const caminhada = library.cardio.find((entry) => entry.name === "Caminhada inclinada")!;
    await applyLibraryItem({ tenantId: f.tenant.id, actorUserId: f.owner.id, kind: "treino", id: caminhada.id, studentIds: [f.ana.id] }, prisma);
    const copy = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.ana.id }, prisma))!;
    expect(copy.planName).toBe("Caminhada inclinada");
    expect(copy.workouts).toHaveLength(1);
    expect((await getLibrary({ tenantId: f.tenant.id }, prisma)).programs).toHaveLength(3);
  });

  it("trocar na cópia gera nova versão, mantém a biblioteca e o histórico e permite desfazer", async () => {
    const f = await setup("troca");
    const library = await getLibrary({ tenantId: f.tenant.id }, prisma);
    const hipertrofia = library.programs.find((entry) => entry.name === "Hipertrofia 8 semanas")!;
    await applyLibraryItem({ tenantId: f.tenant.id, actorUserId: f.owner.id, kind: "programa", id: hipertrofia.id, studentIds: [f.pedro.id] }, prisma);
    const before = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.pedro.id }, prisma))!;
    const squat = before.workouts[0]!.items[0]!;
    expect(squat.muscle).toBe("Quadríceps");

    const options = await listSwapOptions({ tenantId: f.tenant.id, exerciseId: squat.exerciseId }, prisma);
    expect(options.length).toBeGreaterThan(3);
    expect(options.every((option) => option.muscle === "Quadríceps")).toBe(true);
    const target = options[0]!;

    const session = await prisma.workoutSession.create({ data: { tenantId: f.tenant.id, studentId: f.pedro.id, workoutId: before.workouts[0]!.id, status: "CONCLUIDA", endedAt: new Date() } });
    const revision = await reviseStudentCopy({ tenantId: f.tenant.id, actorUserId: f.owner.id, studentId: f.pedro.id, edit: { kind: "swap", itemId: squat.id, exerciseId: target.id } }, prisma);
    const after = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.pedro.id }, prisma))!;
    expect(revision.previousPlanId).toBe(before.planId);
    expect(after.planId).toBe(revision.planId);
    expect(after.workouts[0]!.items[0]).toMatchObject({ name: target.name, exerciseId: target.id, sets: squat.sets, reps: squat.reps });
    expect(after.assignmentId).toBe(before.assignmentId);
    // Histórico na versão antiga, intacto.
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id }, include: { workout: true } })).workout.trainingPlanId).toBe(before.planId);
    // Biblioteca sem mudança.
    const libraryAfter = await getLibrary({ tenantId: f.tenant.id }, prisma);
    expect(libraryAfter.programs.find((entry) => entry.id === hipertrofia.id)!.lines).toEqual(hipertrofia.lines);

    await restoreStudentCopy({ tenantId: f.tenant.id, actorUserId: f.owner.id, studentId: f.pedro.id, planId: revision.previousPlanId }, prisma);
    expect((await getStudentCopy({ tenantId: f.tenant.id, studentId: f.pedro.id }, prisma))!.workouts[0]!.items[0]!.name).toBe(squat.name);
  });

  it("aeróbico: troca só por aeróbico, ajusta tempo e intensidade e entra no fim do treino", async () => {
    const f = await setup("aerobico");
    const library = await getLibrary({ tenantId: f.tenant.id }, prisma);
    const emagrecimento = library.programs.find((entry) => entry.name === "Emagrecimento 6 semanas")!;
    await applyLibraryItem({ tenantId: f.tenant.id, actorUserId: f.owner.id, kind: "programa", id: emagrecimento.id, studentIds: [f.ana.id] }, prisma);
    const copy = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.ana.id }, prisma))!;
    const walk = copy.workouts.find((workout) => workout.name === "Caminhada inclinada")!.items[0]!;
    const options = await listSwapOptions({ tenantId: f.tenant.id, exerciseId: walk.exerciseId }, prisma);
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options.every((option) => option.type === "Aeróbico")).toBe(true);

    await reviseStudentCopy({ tenantId: f.tenant.id, actorUserId: f.owner.id, studentId: f.ana.id, edit: { kind: "update", itemId: walk.id, durationSeconds: 40 * 60, intensity: "FORTE" } }, prisma);
    let now = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.ana.id }, prisma))!;
    expect(now.workouts.find((workout) => workout.name === "Caminhada inclinada")!.items[0]).toMatchObject({ durationSeconds: 2400, intensity: "FORTE" });

    const elliptical = options.find((option) => option.name === "Elíptico")!;
    const strengthWorkout = now.workouts.find((workout) => workout.name === "Corpo todo B")!;
    await reviseStudentCopy({ tenantId: f.tenant.id, actorUserId: f.owner.id, studentId: f.ana.id, edit: { kind: "addItem", workoutId: strengthWorkout.id, exerciseId: elliptical.id } }, prisma);
    now = (await getStudentCopy({ tenantId: f.tenant.id, studentId: f.ana.id }, prisma))!;
    expect(now.workouts.find((workout) => workout.name === "Corpo todo B")!.items.at(-1)).toMatchObject({ name: "Elíptico", isCardio: true, durationSeconds: 1200, intensity: "MODERADO", sets: null });

    await expect(reviseStudentCopy({ tenantId: f.tenant.id, actorUserId: f.owner.id, studentId: f.ana.id, edit: { kind: "update", itemId: "nao-existe", sets: 3 } }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
