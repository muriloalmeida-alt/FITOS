// @vitest-environment node
//
// Funcional e CrossFit (etapa 4) contra PostgreSQL real: blocos no treino
// retroativo, só com o resultado quantitativo; editar troca blocos e
// resultados e guarda a versão anterior na trilha.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { recordRetroactiveWorkout, updateRetroactiveWorkout } from "./retroactive";
import { getFinishedSessionForSelf } from "./finishedSession";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = new Date("2026-10-11T15:00:00Z");
const performedAt = new Date("2026-10-09T21:30:00Z");

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSessionRevision.deleteMany({ where: tenant });
  await prisma.workoutSetResult.deleteMany({ where: tenant });
  await prisma.workoutSessionResult.deleteMany({ where: tenant });
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workoutExercise.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function setup() {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const make = (name: string) => prisma.exercise.create({ data: { tenantId: null, origin: "API_NINJAS", name: `${name} ${label} ${run}`, muscle: "Corpo todo", type: "Peso corporal" } });
  return { owner, scope: { tenantId: tenant.id, studentId: student.id }, burpee: await make("Burpee"), squat: await make("Air squat"), row: await make("Remada") };
}

const key = () => `retro-blocos-${run}-${++counter}`;
const amrap = { key: "wod", kind: "AMRAP", windowSeconds: 720 };
const forTime = { key: "ft", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 };

describe("blocos no treino retroativo", () => {
  it("grava o bloco, os exercícios sem séries e o resultado; o detalhe mostra o resumo", async () => {
    const { scope, burpee, squat, row } = await setup();
    const result = await recordRetroactiveWorkout(
      {
        ...scope,
        operationKey: key(),
        performedAt,
        durationSeconds: 40 * 60,
        now,
        exercises: [
          { exerciseId: row.id, sets: [{ reps: 12, loadKg: 40 }] },
          { exerciseId: burpee.id, blockKey: "wod", sets: [] },
          { exerciseId: squat.id, blockKey: "wod", sets: [] },
        ],
        blocks: [{ block: amrap, result: { outcome: "PARCIAL", roundsCompleted: 5, partialReps: 8, note: "escalei" } }],
      },
      prisma
    );
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: result.sessionId }, include: { workout: { include: { workoutExercises: true } }, blockResults: true, setResults: true } });
    expect(session.workout.blocks).toEqual([expect.objectContaining({ key: "wod", kind: "AMRAP", windowSeconds: 720 })]);
    expect(session.workout.workoutExercises.filter((item) => item.blockKey === "wod")).toHaveLength(2);
    expect(session.setResults).toHaveLength(1);
    expect(session.blockResults).toEqual([expect.objectContaining({ blockKey: "wod", outcome: "PARCIAL", roundsCompleted: 5, partialReps: 8, elapsedSeconds: null, note: "escalei", startedAt: null })]);

    const detail = await getFinishedSessionForSelf(scope, result.sessionId, prisma, now);
    expect(detail?.blocks).toEqual([expect.objectContaining({ block: expect.objectContaining({ key: "wod" }), result: expect.objectContaining({ roundsCompleted: 5 }) })]);
    expect(detail?.exercises.map((item) => item.blockKey)).toEqual([null, "wod", "wod"]);
  });

  it("For Time concluído exige o tempo declarado; limite atingido nunca grava tempo; bloco vazio e chave desconhecida são recusados", async () => {
    const { scope, burpee } = await setup();
    const base = { ...scope, performedAt, durationSeconds: 30 * 60, now };
    const inBlock = [{ exerciseId: burpee.id, blockKey: "ft", sets: [] }];
    await expect(recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: inBlock, blocks: [{ block: forTime, result: { outcome: "CONCLUIDO" } }] }, prisma)).rejects.toThrow(/em quanto tempo/);
    await expect(recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: [{ exerciseId: burpee.id, sets: [{ reps: 10 }] }], blocks: [{ block: forTime, result: { outcome: "PARCIAL" } }] }, prisma)).rejects.toThrow(/pelo menos um exercício/);
    await expect(recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: [{ exerciseId: burpee.id, blockKey: "outro", sets: [] }] }, prisma)).rejects.toThrow(/Bloco não encontrado/);
    await expect(recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: inBlock, blocks: [{ block: amrap, result: { outcome: "LIMITE_ATINGIDO" } }] }, prisma)).rejects.toThrow(/Bloco não encontrado|só do For Time/);

    const capped = await recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: inBlock, blocks: [{ block: forTime, result: { outcome: "LIMITE_ATINGIDO", roundsCompleted: 2, partialReps: 10, elapsedSeconds: 900 } }] }, prisma);
    expect(await prisma.workoutBlockResult.findFirstOrThrow({ where: { sessionId: capped.sessionId } })).toMatchObject({ outcome: "LIMITE_ATINGIDO", elapsedSeconds: null });
    const done = await recordRetroactiveWorkout({ ...base, operationKey: key(), exercises: inBlock, blocks: [{ block: forTime, result: { outcome: "CONCLUIDO", roundsCompleted: 3, elapsedSeconds: 582 } }] }, prisma);
    expect(await prisma.workoutBlockResult.findFirstOrThrow({ where: { sessionId: done.sessionId } })).toMatchObject({ outcome: "CONCLUIDO", elapsedSeconds: 582 });
  });

  it("editar troca blocos e resultados; a trilha guarda os de antes", async () => {
    const { owner, scope, burpee, squat } = await setup();
    const created = await recordRetroactiveWorkout(
      { ...scope, operationKey: key(), performedAt, durationSeconds: 30 * 60, now, exercises: [{ exerciseId: burpee.id, blockKey: "wod", sets: [] }], blocks: [{ block: amrap, result: { roundsCompleted: 4 } }] },
      prisma
    );
    await updateRetroactiveWorkout(
      { ...scope, actorUserId: owner.id, sessionId: created.sessionId, performedAt, durationSeconds: 35 * 60, now, exercises: [{ exerciseId: burpee.id, blockKey: "ft", sets: [] }, { exerciseId: squat.id, sets: [{ reps: 20 }] }], blocks: [{ block: forTime, result: { outcome: "CONCLUIDO", elapsedSeconds: 700 } }] },
      prisma
    );
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: created.sessionId }, include: { workout: true, blockResults: true } });
    expect(session.workout.blocks).toEqual([expect.objectContaining({ key: "ft" })]);
    expect(session.blockResults).toEqual([expect.objectContaining({ blockKey: "ft", elapsedSeconds: 700 })]);
    const revision = await prisma.workoutSessionRevision.findFirstOrThrow({ where: { sessionId: created.sessionId } });
    expect(revision.snapshot).toMatchObject({ blockResults: [{ blockKey: "wod", roundsCompleted: 4 }], exercises: [{ blockKey: "wod" }] });

    // Sem blocos de novo: limpa tudo.
    await updateRetroactiveWorkout({ ...scope, actorUserId: owner.id, sessionId: created.sessionId, performedAt, durationSeconds: 35 * 60, now, exercises: [{ exerciseId: squat.id, sets: [{ reps: 20 }] }] }, prisma);
    const cleared = await prisma.workoutSession.findUniqueOrThrow({ where: { id: created.sessionId }, include: { workout: true, blockResults: true } });
    expect(cleared.workout.blocks).toBeNull();
    expect(cleared.blockResults).toHaveLength(0);
  });
});
