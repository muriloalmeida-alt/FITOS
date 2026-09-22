// @vitest-environment node
//
// Testes de integração de preservação de histórico (FIT-107) contra
// PostgreSQL real (banco de testes). Verifica, ponta a ponta, que
// `endStudentBond` (FIT-106) nunca perde nem duplica nenhum dado já
// registrado — a restrição obrigatória do pacote ("aluno mantém perfil,
// medidas, execuções, cargas, frequência, recordes...") é satisfeita
// porque `endStudentBond` só grava três campos no próprio `Student`;
// este arquivo prova isso com dados reais de cada domínio, não apenas
// lendo o código.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { endStudentBond } from "./students";
import { addWorkoutExercise, assignTrainingPlanToStudent, createTrainingPlan, createWorkout, moveWorkoutToPlan } from "@/modules/workouts/workouts";
import { completeWorkoutSession, recordSessionResult, startOrResumeWorkoutSession } from "@/modules/execution/sessions";
import { createAssessment } from "@/modules/evolution/assessments";
import { createStudentCharge, registerPayment } from "@/modules/student-finance/charges";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.bodyMeasurement.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.assessment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSessionResult.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" DISABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" DISABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "workout_exercises" ENABLE TRIGGER "workout_exercises_snapshot_immutability_guard"');
  await prisma.$executeRawUnsafe('ALTER TABLE "workouts" ENABLE TRIGGER "workouts_snapshot_immutability_guard"');
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { name: { contains: run } } });
  await prisma.student.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("endStudentBond preserva todo o histórico (FIT-107)", () => {
  it("nunca perde nem duplica sessões/resultados, avaliações/medidas, cobranças/pagamentos ou o plano atribuído", async () => {
    const owner = await prisma.user.create({
      data: { email: `dono-preservacao-${run}@example.test`, name: "Dono", role: "PERSONAL" },
    });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant preservacao ${run}` } });
    const student = await prisma.student.create({
      data: { tenantId: tenant.id, email: `aluno-preservacao-${run}@example.test`, displayName: "Aluno Preservação" },
    });
    const exercise = await prisma.exercise.create({
      data: { tenantId: null, origin: "API_NINJAS", name: `Global preservacao ${run}` },
    });

    // Execução: plano atribuído, treino, sessão concluída com resultado.
    const plan = await createTrainingPlan({ tenantId: tenant.id, name: `Plano preservacao ${run}` }, prisma);
    const workout = await createWorkout({ tenantId: tenant.id, name: `Treino preservacao ${run}` }, prisma);
    await moveWorkoutToPlan({ tenantId: tenant.id, workoutId: workout.id, targetTrainingPlanId: plan.id }, prisma);
    await addWorkoutExercise({ tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, sets: 3, reps: 10 }, prisma);
    const assignment = await assignTrainingPlanToStudent(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, trainingPlanId: plan.id },
      prisma
    );
    const snapshot = await prisma.trainingPlan.findUniqueOrThrow({
      where: { id: assignment.trainingPlanId },
      include: { workouts: { include: { workoutExercises: true } } },
    });
    const snapshotWorkout = snapshot.workouts[0]!;
    const snapshotItem = snapshotWorkout.workoutExercises[0]!;
    const session = await startOrResumeWorkoutSession({ tenantId: tenant.id, studentId: student.id, workoutId: snapshotWorkout.id }, prisma);
    await recordSessionResult(
      { tenantId: tenant.id, studentId: student.id, sessionId: session.id, workoutExerciseId: snapshotItem.id, setsCompleted: 3, repsCompleted: 10, durationSecondsCompleted: null, loadUsed: "20kg" },
      prisma
    );
    await completeWorkoutSession({ tenantId: tenant.id, studentId: student.id, sessionId: session.id }, prisma);

    // Evolução: avaliação com medida.
    await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: 80, bodyFatPercent: 18, notes: "Evolução", measurementsCm: [{ type: "CINTURA", valueCm: 85 }] },
      prisma
    );

    // Financeiro: cobrança paga.
    const charge = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 150, referenceMonth: new Date("2026-09-01"), dueDate: new Date("2026-09-10") },
      prisma
    );
    await registerPayment({ tenantId: tenant.id, actorUserId: owner.id, chargeId: charge.id, amountReceivedReais: 150, paidAt: new Date("2026-09-05"), method: "PIX" }, prisma);

    // Snapshot de todas as contagens e conteúdos ANTES de encerrar o vínculo.
    const before = {
      sessions: await prisma.workoutSession.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
      results: await prisma.workoutSessionResult.findMany({ where: { tenantId: tenant.id, workoutSession: { studentId: student.id } } }),
      assessments: await prisma.assessment.findMany({ where: { tenantId: tenant.id, studentId: student.id }, include: { measurements: true } }),
      charges: await prisma.studentCharge.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
      payments: await prisma.payment.findMany({ where: { tenantId: tenant.id, studentCharge: { studentId: student.id } } }),
      assignments: await prisma.planAssignment.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
    };
    expect(before.sessions).toHaveLength(1);
    expect(before.results).toHaveLength(1);
    expect(before.assessments).toHaveLength(1);
    expect(before.assessments[0]!.measurements).toHaveLength(1);
    expect(before.charges).toHaveLength(1);
    expect(before.payments).toHaveLength(1);
    expect(before.assignments).toHaveLength(1);

    await endStudentBond({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id, reason: "Encerramento de teste" }, prisma);

    const after = {
      sessions: await prisma.workoutSession.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
      results: await prisma.workoutSessionResult.findMany({ where: { tenantId: tenant.id, workoutSession: { studentId: student.id } } }),
      assessments: await prisma.assessment.findMany({ where: { tenantId: tenant.id, studentId: student.id }, include: { measurements: true } }),
      charges: await prisma.studentCharge.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
      payments: await prisma.payment.findMany({ where: { tenantId: tenant.id, studentCharge: { studentId: student.id } } }),
      assignments: await prisma.planAssignment.findMany({ where: { tenantId: tenant.id, studentId: student.id } }),
    };

    // Nem perda (mesma contagem) nem duplicação (mesmos ids, mesmo conteúdo) — nenhuma linha nova, nenhuma removida.
    expect(after.sessions).toEqual(before.sessions);
    expect(after.results).toEqual(before.results);
    expect(after.assessments).toEqual(before.assessments);
    expect(after.charges).toEqual(before.charges);
    expect(after.payments).toEqual(before.payments);
    expect(after.assignments).toEqual(before.assignments);
  });
});
