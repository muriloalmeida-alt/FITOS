// @vitest-environment node
//
// Progressão para o personal (EPIC-44) contra PostgreSQL real: histórico
// lido por exercício através das versões da cópia, aprovar gera nova
// versão com a carga, avisa o aluno e some da lista.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, type Sender } from "@/modules/notifications/push";
import { reviseStudentCopy } from "@/modules/library/studentCopy";
import { approveCoachProgression, suggestCoachProgressions } from "./progression";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.auditEvent.deleteMany({ where });
  await prisma.workoutSetResult.deleteMany({ where });
  await prisma.workoutSession.deleteMany({ where });
  await prisma.planAssignment.deleteMany({ where });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" DISABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" DISABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.workoutExercise.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" ENABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" ENABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("progressão para o personal (EPIC-44)", () => {
  it("sugere pelo histórico de versões anteriores; aprovar sobe, avisa e some", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const user = await prisma.user.create({ data: { email: `ana-${run}@example.test`, name: "Ana", role: "ALUNO" } });
    await saveSubscription({ userId: user.id, subscription: { endpoint: `https://push.example/ana-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
    const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: "Ana Costa" } });
    const supino = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino ${run}`, origin: "PERSONAL" } });
    const remada = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Remada ${run}`, origin: "PERSONAL" } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia" } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
    const supinoItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: supino.id, position: 0, sets: 3, reps: 10, load: "40 kg" } });
    const remadaItem = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: remada.id, position: 1, sets: 3, reps: 10, load: "30 kg" } });
    await prisma.trainingPlan.update({ where: { id: plan.id }, data: { isSnapshot: true } });
    await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id } });

    const train = async (effort: number, remadaReps: number, daysAgo: number) => {
      const at = new Date(Date.now() - daysAgo * 86_400_000);
      const session = await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, status: "CONCLUIDA", startedAt: at, endedAt: at, perceivedEffort: effort } });
      for (const setNumber of [1, 2, 3]) {
        await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: supinoItem.id, setNumber, reps: 10, loadGrams: 40000 } });
        await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: remadaItem.id, setNumber, reps: remadaReps, loadGrams: 30000 } });
      }
    };
    await train(3, 8, 5);
    await train(2, 10, 2);

    // Um ajuste qualquer na cópia gera itens novos; o histórico continua valendo.
    await reviseStudentCopy({ tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, edit: { kind: "update", itemId: remadaItem.id, sets: 4 } }, prisma);

    const suggestions = await suggestCoachProgressions({ tenantId: tenant.id }, prisma);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ studentId: student.id, studentName: "Ana Costa", exerciseName: `Supino ${run}`, fromKg: 40, toKg: 42.5, reps: 10, workoutName: "Treino A" });
    expect(suggestions[0]!.itemId).not.toBe(supinoItem.id);

    const sent: { title: string; body: string }[] = [];
    const sender: Sender = async (_subscription, payload) => void sent.push(JSON.parse(payload));
    const { previousPlanId } = await approveCoachProgression({ tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, itemId: suggestions[0]!.itemId, toKg: 42.5 }, { client: prisma, sender, config });
    expect(previousPlanId).not.toBe(plan.id);
    const active = await prisma.planAssignment.findFirstOrThrow({ where: { studentId: student.id, active: true }, include: { trainingPlan: { include: { workouts: { include: { workoutExercises: true } } } } } });
    expect(active.trainingPlan.workouts[0]!.workoutExercises.find((item) => item.exerciseId === supino.id)!.load).toBe("42,5 kg");
    expect(sent).toEqual([{ title: "Murilo subiu sua carga", body: `Supino ${run}: 42,5 kg a partir do próximo treino.`, url: "/painel/treino", tag: expect.any(String) }]);
    expect(await suggestCoachProgressions({ tenantId: tenant.id }, prisma)).toEqual([]);

    // Item de outro aluno/espaço: não encontrado.
    await expect(approveCoachProgression({ tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, itemId: supinoItem.id, toKg: 50 }, { client: prisma, config: null })).rejects.toThrow("Exercício não encontrado no programa do aluno.");
  });
});
