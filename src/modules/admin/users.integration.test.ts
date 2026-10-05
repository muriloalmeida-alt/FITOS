// @vitest-environment node
//
// Administração de usuários: listagem, troca de senha e exclusão completa
// (personal com espaço inteiro; aluno com seus treinos). PostgreSQL real.
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { deleteUserByAdmin, getUserForAdmin, listUsersForAdmin, setUserPasswordByAdmin } from "./users";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.chargeRecurrence.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

/// Espaço de personal completo: aluno com conta, exercício próprio,
/// programa atribuído, execução com séries, cobrança recorrente paga,
/// avaliação e assinatura no Asaas.
async function setup(label: string) {
  const admin = await prisma.user.create({ data: { email: `admin-${label}-${run}@example.test`, name: "Admin", role: "ADMIN" } });
  const owner = await prisma.user.create({ data: { email: `personal-${label}-${run}@example.test`, name: "Joana Personal", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}` } });
  const studentUser = await prisma.user.create({ data: { email: `aluno-${label}-${run}@example.test`, name: "Pedro Aluno", role: "ALUNO" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: studentUser.id, email: studentUser.email, displayName: "Pedro" } });
  const exercise = await prisma.exercise.create({ data: { tenantId: tenant.id, name: `Supino ${label} ${run}`, origin: "PERSONAL" } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
  const item = await prisma.workoutExercise.create({ data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, position: 0, sets: 3, reps: 12 } });
  await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: student.id, trainingPlanId: plan.id } });
  const session = await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: student.id, workoutId: workout.id, status: "CONCLUIDA", endedAt: new Date() } });
  await prisma.workoutSessionResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: item.id, setsCompleted: 1 } });
  await prisma.workoutSetResult.create({ data: { tenantId: tenant.id, workoutSessionId: session.id, workoutExerciseId: item.id, setNumber: 1, reps: 12, loadGrams: 40_000 } });
  const recurrence = await prisma.chargeRecurrence.create({ data: { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountCents: 18000, dueDayOfMonth: 10 } });
  const charge = await prisma.studentCharge.create({
    data: { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountCents: 18000, referenceMonth: new Date(2026, 9, 1), dueDate: new Date(2026, 9, 10), recurrenceId: recurrence.id, status: "PAGO" },
  });
  await prisma.payment.create({ data: { tenantId: tenant.id, studentChargeId: charge.id, amountCentsPaid: 18000, paidAt: new Date(), method: "PIX", recordedByUserId: owner.id } });
  await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: student.id, authorUserId: owner.id, weightGrams: 80_000 } });
  await prisma.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: owner.id, action: "TESTE", entityType: "Student", entityId: student.id } });
  const saasPlan = await prisma.plan.create({ data: { slug: `plano-${label}-${run}`, audience: "PERSONAL", name: "Personal 20", priceCents: 4990, billingCycle: "MENSAL" } });
  await prisma.saasSubscription.create({ data: { tenantId: tenant.id, planId: saasPlan.id, provider: "asaas", externalSubscriptionId: `sub_${label}` } });
  return { admin, owner, tenant, studentUser, student, plan, workout };
}

describe("administração de usuários", () => {
  it("lista com busca por nome ou e-mail e mostra o espaço de cada um", async () => {
    const f = await setup("lista");
    const result = await listUsersForAdmin({ query: `lista-${run}` }, prisma);
    expect(result.total).toBe(3);
    const byEmail = Object.fromEntries(result.users.map((user) => [user.email, user]));
    expect(byEmail[f.owner.email]).toMatchObject({ role: "PERSONAL", spaceName: f.tenant.name, hasPassword: false });
    expect(byEmail[f.studentUser.email]).toMatchObject({ role: "ALUNO", spaceName: f.tenant.name });
    expect((await listUsersForAdmin({ query: `lista-${run}`, role: "ALUNO" }, prisma)).users.map((user) => user.email)).toEqual([f.studentUser.email]);

    const detail = await getUserForAdmin(f.owner.id, prisma);
    expect(detail.counts).toEqual({ students: 1, trainingPlans: 1, workoutSessions: 1, assessments: 1, charges: 1 });
    expect(detail.subscription).toEqual({ planName: "Personal 20", status: "ATIVA" });
  });

  it("troca a senha (cria a credencial se faltar) e derruba as sessões abertas", async () => {
    const f = await setup("senha");
    await prisma.session.create({ data: { userId: f.studentUser.id, token: `tok-${run}`, expiresAt: new Date(Date.now() + 86_400_000) } });

    await setUserPasswordByAdmin({ adminUserId: f.admin.id, userId: f.studentUser.id, password: "nova-senha-123" }, prisma);
    const credential = await prisma.account.findFirstOrThrow({ where: { userId: f.studentUser.id, providerId: "credential" } });
    expect(await verifyPassword({ hash: credential.password!, password: "nova-senha-123" })).toBe(true);
    expect(await prisma.session.count({ where: { userId: f.studentUser.id } })).toBe(0);

    await setUserPasswordByAdmin({ adminUserId: f.admin.id, userId: f.studentUser.id, password: "outra-senha-456" }, prisma);
    expect(await prisma.account.count({ where: { userId: f.studentUser.id } })).toBe(1);

    await expect(setUserPasswordByAdmin({ adminUserId: f.admin.id, userId: f.studentUser.id, password: "curta" }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    const otherAdmin = await prisma.user.create({ data: { email: `admin2-${run}@example.test`, name: "Outro admin", role: "ADMIN" } });
    await expect(setUserPasswordByAdmin({ adminUserId: f.admin.id, userId: otherAdmin.id, password: "nova-senha-123" }, prisma)).rejects.toMatchObject({ kind: "PROIBIDO" });
  });

  it("excluir aluno remove o cadastro e os treinos dele; o espaço do personal continua", async () => {
    const f = await setup("aluno");
    await deleteUserByAdmin({ adminUserId: f.admin.id, userId: f.studentUser.id }, prisma);

    expect(await prisma.user.findUnique({ where: { id: f.studentUser.id } })).toBeNull();
    expect(await prisma.student.findUnique({ where: { id: f.student.id } })).toBeNull();
    expect(await prisma.workoutSession.count({ where: { studentId: f.student.id } })).toBe(0);
    expect(await prisma.studentCharge.count({ where: { studentId: f.student.id } })).toBe(0);
    expect(await prisma.tenant.findUnique({ where: { id: f.tenant.id } })).not.toBeNull();
    expect(await prisma.trainingPlan.findUnique({ where: { id: f.plan.id } })).not.toBeNull();
  });

  it("excluir personal remove o espaço inteiro, cancela a assinatura no Asaas e mantém a conta do aluno sem vínculo", async () => {
    const f = await setup("personal");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    await deleteUserByAdmin({ adminUserId: f.admin.id, userId: f.owner.id }, prisma, { apiKey: "chave", fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toContain("sub_personal");
    expect(await prisma.user.findUnique({ where: { id: f.owner.id } })).toBeNull();
    expect(await prisma.tenant.findUnique({ where: { id: f.tenant.id } })).toBeNull();
    for (const count of [
      prisma.student.count({ where: { tenantId: f.tenant.id } }),
      prisma.workout.count({ where: { tenantId: f.tenant.id } }),
      prisma.workoutSession.count({ where: { tenantId: f.tenant.id } }),
      prisma.payment.count({ where: { tenantId: f.tenant.id } }),
      prisma.assessment.count({ where: { tenantId: f.tenant.id } }),
    ]) {
      expect(await count).toBe(0);
    }
    expect(await prisma.user.findUnique({ where: { id: f.studentUser.id } })).not.toBeNull();
  });

  it("nunca exclui administrador nem a própria conta", async () => {
    const f = await setup("protege");
    await expect(deleteUserByAdmin({ adminUserId: f.admin.id, userId: f.admin.id }, prisma)).rejects.toMatchObject({ kind: "PROIBIDO" });
    const otherAdmin = await prisma.user.create({ data: { email: `admin3-${run}@example.test`, name: "Outro admin", role: "ADMIN" } });
    await expect(deleteUserByAdmin({ adminUserId: f.admin.id, userId: otherAdmin.id }, prisma)).rejects.toMatchObject({ kind: "PROIBIDO" });
    await expect(deleteUserByAdmin({ adminUserId: f.admin.id, userId: "nao-existe" }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
