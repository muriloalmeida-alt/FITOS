// @vitest-environment node
//
// FIT-143 (EPIC-19): feed "Acontecendo agora" do Início do personal
// (BK-05). PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getPersonalFeed } from "./personalFeed";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.workoutSession.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.invitation.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.assessment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("getPersonalFeed (FIT-143, BK-05)", () => {
  it("um item por aluno, pelo sinal de maior prioridade, só do próprio tenant", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant feed ${run}` } });
    const otherOwner = await prisma.user.create({ data: { email: `outro-${run}@example.test`, name: "Outro", role: "PERSONAL" } });
    const other = await prisma.tenant.create({ data: { ownerId: otherOwner.id, name: `Outro feed ${run}` } });
    const user = (name: string) => prisma.user.create({ data: { email: `${name}-user-${run}@example.test`, name, role: "ALUNO" } });
    const mk = async (name: string, withAccount = true, extra: Record<string, unknown> = {}) =>
      prisma.student.create({ data: { tenantId: tenant.id, email: `${name}-${run}@example.test`, displayName: name, userId: withAccount ? (await user(name)).id : null, ...extra } });

    const now = new Date(2026, 9, 8, 12);
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia", durationWeeks: 4, isSnapshot: false } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
    const assign = (studentId: string, assignedAt: Date) => prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId, trainingPlanId: plan.id, assignedAt } });
    const assess = (studentId: string, recordedAt: Date) => prisma.assessment.create({ data: { tenantId: tenant.id, studentId, authorUserId: owner.id, recordedAt } });

    // Bruno: cobrança atrasada vence sobre tudo.
    const bruno = await mk("Bruno");
    await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: bruno.id, description: "Mensalidade", amountCents: 18000, referenceMonth: new Date(2026, 9, 1), dueDate: new Date(2020, 0, 1) } });
    // Pedro: convite expirado.
    const pedro = await mk("Pedro", false);
    await prisma.invitation.create({ data: { tenantId: tenant.id, studentId: pedro.id, tokenHash: `hash-p-${run}`, expiresAt: new Date(2026, 9, 1) } });
    // Carla: aceitou o convite há 2 dias, sem programa.
    const carla = await mk("Carla");
    await prisma.invitation.create({ data: { tenantId: tenant.id, studentId: carla.id, tokenHash: `hash-c-${run}`, status: "ACEITO", expiresAt: new Date(2026, 9, 20), acceptedAt: new Date(2026, 9, 6) } });
    // Davi: sem programa, conta antiga.
    await mk("Davi");
    // Eva: programa de 4 semanas termina em 3 dias.
    const eva = await mk("Eva");
    await assign(eva.id, new Date(now.getTime() - 25 * 86_400_000));
    await assess(eva.id, new Date(2026, 9, 1));
    // Fábio: concluiu treino ontem com esforço 4; avaliação vencida fica atrás.
    const fabio = await mk("Fábio");
    await assign(fabio.id, new Date(2026, 9, 5));
    await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: fabio.id, workoutId: workout.id, status: "CONCLUIDA", startedAt: new Date(2026, 9, 7, 18), endedAt: new Date(2026, 9, 7, 18, 52), perceivedEffort: 4 } });
    // Gabi: programa em dia, avaliação há 90 dias.
    const gabi = await mk("Gabi");
    await assign(gabi.id, new Date(2026, 9, 5));
    await assess(gabi.id, new Date(now.getTime() - 90 * 86_400_000));
    // Hugo: tudo em dia → fora do feed.
    const hugo = await mk("Hugo");
    await assign(hugo.id, new Date(2026, 9, 5));
    await assess(hugo.id, new Date(2026, 9, 1));
    // Inativo e aluno de outro tenant nunca aparecem.
    await mk("Iris", true, { status: "INATIVO" });
    await prisma.student.create({ data: { tenantId: other.id, email: `alheio-${run}@example.test`, displayName: "Alheio" } });

    const feed = await getPersonalFeed({ tenantId: tenant.id, now, limit: 20 }, prisma);
    expect(feed.items.map((item) => [item.studentName, item.kind])).toEqual([
      ["Bruno", "cobranca_atrasada"],
      ["Pedro", "convite_expirado"],
      ["Carla", "convite_aceito"],
      ["Davi", "sem_programa"],
      ["Eva", "programa_terminando"],
      ["Fábio", "treino_concluido"],
      ["Gabi", "avaliacao_pendente"],
    ]);
    const byName = Object.fromEntries(feed.items.map((item) => [item.studentName, item]));
    expect(byName.Bruno).toMatchObject({ actionLabel: "Registrar pagamento", href: `/painel/alunos/${bruno.id}?acao=receber`, amountCents: 18000 });
    expect(byName.Eva?.description).toBe("Hipertrofia termina em 3 dias");
    expect(byName.Fábio).toMatchObject({ description: "Concluiu Treino A · 52 min · esforço puxado", perceivedEffort: 4, actionLabel: "Ver evolução" });
    expect(byName.Gabi).toMatchObject({ description: "Última avaliação há 90 dias", href: `/painel/alunos/${gabi.id}?acao=avaliar` });

    const short = await getPersonalFeed({ tenantId: tenant.id, now, limit: 3 }, prisma);
    expect(short.items).toHaveLength(3);
    expect(short.total).toBe(7);
  });
});
