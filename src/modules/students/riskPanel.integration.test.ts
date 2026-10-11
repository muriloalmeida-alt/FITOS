// @vitest-environment node
//
// Painel de risco (EPIC-43) contra PostgreSQL real: cada sinal, o nível,
// a ação principal e quem não entra.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getRiskPanel, sessionsDropSignal } from "./riskPanel";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DAY = 86_400_000;
const now = new Date("2026-10-06T15:00:00Z");
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 3_600_000);

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.chatMessage.deleteMany({ where });
  await prisma.chatTopic.deleteMany({ where });
  await prisma.studentCharge.deleteMany({ where });
  await prisma.workoutSession.deleteMany({ where });
  await prisma.planAssignment.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("painel de risco (EPIC-43)", () => {
  it("queda de frequência só com histórico", () => {
    expect(sessionsDropSignal(1, 4)?.label).toBe("Treinou 1 vez em 2 semanas (antes, ~4)");
    expect(sessionsDropSignal(3, 4)).toBeNull();
    expect(sessionsDropSignal(0, 1)).toBeNull();
  });

  it("sinais, nível e ação principal", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "Hipertrofia", durationWeeks: 8 } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "Treino A", position: 0 } });
    const student = async (name: string, opts: { assignedDaysAgo?: number; sessionsDaysAgo?: number[]; overdueCents?: number; unansweredHours?: number; status?: "ATIVO" | "INATIVO" } = {}) => {
      const created = await prisma.student.create({ data: { tenantId: tenant.id, email: `${name}-${run}@example.test`.toLowerCase(), displayName: name, status: opts.status ?? "ATIVO", createdAt: ago(120) } });
      if (opts.assignedDaysAgo !== undefined) await prisma.planAssignment.create({ data: { tenantId: tenant.id, studentId: created.id, trainingPlanId: plan.id, assignedAt: ago(opts.assignedDaysAgo) } });
      for (const days of opts.sessionsDaysAgo ?? []) await prisma.workoutSession.create({ data: { tenantId: tenant.id, studentId: created.id, workoutId: workout.id, status: "CONCLUIDA", startedAt: ago(days), endedAt: ago(days) } });
      if (opts.overdueCents) await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: created.id, description: "Mensalidade", amountCents: opts.overdueCents, referenceMonth: new Date("2026-09-01T00:00:00Z"), dueDate: ago(20), status: "ATRASADO" } });
      if (opts.unansweredHours) {
        const at = ago(0, opts.unansweredHours);
        await prisma.chatTopic.create({ data: { tenantId: tenant.id, studentId: created.id, category: "OUTRO", lastMessageAt: at, lastStudentMessageAt: at } });
      }
      return created;
    };
    // Ana: parou há 25 dias e está devendo → alto; o sinal mais forte (sem treinar) decide a ação.
    const ana = await student("Ana", { assignedDaysAgo: 40, sessionsDaysAgo: [25, 30, 33], overdueCents: 18000 });
    // Bruno: treinava 2x/semana, nas últimas 2 semanas só 1.
    const brunoSessions = [3, ...Array.from({ length: 16 }, (_, i) => 15 + i * 3.5)];
    await student("Bruno", { assignedDaysAgo: 30, sessionsDaysAgo: brunoSessions });
    // Carla: em dia, mas com mensagem sem resposta há 30 h.
    await student("Carla", { assignedDaysAgo: 10, sessionsDaysAgo: [1, 3, 5], unansweredHours: 30 });
    // Davi: programa de 8 semanas começou há 54 dias (termina em 2) e treina.
    await student("Davi", { assignedDaysAgo: 54, sessionsDaysAgo: [1, 4] });
    // Eva: tudo certo. Fábio: inativo, não entra.
    await student("Eva", { assignedDaysAgo: 10, sessionsDaysAgo: [1, 3, 6] });
    await student("Fabio", { assignedDaysAgo: 40, status: "INATIVO" });

    const rows = await getRiskPanel({ tenantId: tenant.id, now }, prisma);
    expect(rows.map((row) => row.name)).toEqual(["Ana", "Bruno", "Carla"]);
    expect(rows[0]).toMatchObject({ studentId: ana.id, level: "alto", score: 7, action: { label: "Mensagem", href: `/painel/mensagens?aluno=${ana.id}&nova=1` } });
    expect(rows[0]!.signals.map((signal) => signal.label.replace(/\u00a0/g, " "))).toEqual(["Sem treinar há 25 dias", "Mensalidade atrasada (R$ 180,00)"]);
    expect(rows[1]!.signals[0]!.label).toMatch(/^Treinou 1 vez em 2 semanas \(antes, ~\d\)$/);
    expect(rows[1]!.level).toBe("medio");
    expect(rows[2]).toMatchObject({ level: "medio", action: { label: "Responder" } });
    expect(rows[2]!.signals[0]!.label).toBe("Mensagem sem resposta há 30 h");
  });
});
