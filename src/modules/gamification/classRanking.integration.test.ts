// @vitest-environment node
//
// Ranking da turma (Desafios) contra PostgreSQL real: adesão voluntária,
// nada antes da ativação/adesão, só pontos oficiais, isolamento entre
// espaços e vínculo encerrado fora da lista.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getClassRanking, joinClassRanking, leaveClassRanking, setClassRankingEnabled } from "./classRanking";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const activatedAt = new Date("2026-10-05T12:00:00Z");
const now = new Date("2026-10-09T15:00:00Z");

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function space() {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `personal-${label}-${run}@example.test`, name: "Personal", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}` } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
  return { tenantId: tenant.id, workoutId: workout.id };
}

async function student(ctx: { tenantId: string }, name: string) {
  const row = await prisma.student.create({ data: { tenantId: ctx.tenantId, email: `${name}-${++counter}-${run}@example.test`, displayName: name } });
  return { tenantId: ctx.tenantId, studentId: row.id };
}

async function scored(ctx: { tenantId: string; workoutId: string }, studentId: string, iso: string, balancedTenths: number, status: "LIBERADO" | "PENDENTE_FOTO" = "LIBERADO") {
  const at = new Date(iso);
  const session = await prisma.workoutSession.create({ data: { tenantId: ctx.tenantId, studentId, workoutId: ctx.workoutId, status: "CONCLUIDA", startedAt: at, endedAt: at } });
  await prisma.sessionScore.create({ data: { tenantId: ctx.tenantId, studentId, sessionId: session.id, ruleVersion: 1, totalTenths: balancedTenths * 4, plannedItems: 4, balancedTenths, items: [], status, performedAt: at, photoDeadline: at } });
}

describe("ranking da turma", () => {
  it("desligado: ninguém entra nem vê; ligado: só quem aderiu, contando depois da ativação e da adesão", async () => {
    const ctx = await space();
    const ana = await student(ctx, "Ana");
    const bia = await student(ctx, "Bia");
    const caio = await student(ctx, "Caio");
    await expect(joinClassRanking(ana, prisma, now)).rejects.toMatchObject({ kind: "DESLIGADO" });
    await expect(getClassRanking({ role: "PERSONAL", tenantId: ctx.tenantId }, "SEMANA", prisma, now)).rejects.toMatchObject({ kind: "DESLIGADO" });

    await setClassRankingEnabled(ctx.tenantId, true, prisma, activatedAt);
    await joinClassRanking(ana, prisma, activatedAt);
    await joinClassRanking(bia, prisma, new Date("2026-10-07T00:00:00Z"));
    await scored(ctx, ana.studentId, "2026-10-05T10:00:00Z", 200); // antes da ativação: fora
    await scored(ctx, ana.studentId, "2026-10-06T12:00:00Z", 105);
    await scored(ctx, ana.studentId, "2026-10-08T12:00:00Z", 90, "PENDENTE_FOTO"); // sem foto: fora
    await scored(ctx, bia.studentId, "2026-10-06T12:00:00Z", 150); // antes da adesão: fora
    await scored(ctx, bia.studentId, "2026-10-08T12:00:00Z", 100);
    await scored(ctx, caio.studentId, "2026-10-08T12:00:00Z", 300); // não aderiu

    const { rows } = await getClassRanking({ role: "PERSONAL", tenantId: ctx.tenantId }, "SEMANA", prisma, now);
    expect(rows.map((row) => [row.name, row.position, row.pointsTenths, row.isMe])).toEqual([
      ["Ana", 1, 105, false],
      ["Bia", 2, 100, false],
    ]);
    // Aluno que não aderiu não vê; quem aderiu vê e se reconhece.
    await expect(getClassRanking({ role: "ALUNO", ...caio }, "SEMANA", prisma, now)).rejects.toMatchObject({ kind: "PROIBIDO" });
    expect((await getClassRanking({ role: "ALUNO", ...bia }, "SEMANA", prisma, now)).rows.find((row) => row.isMe)?.name).toBe("Bia");
  });

  it("sair tira da lista; vínculo encerrado some; outro espaço não aparece", async () => {
    const ctx = await space();
    const other = await space();
    const ana = await student(ctx, "Ana");
    const bia = await student(ctx, "Bia");
    const intruso = await student(other, "Intruso");
    await setClassRankingEnabled(ctx.tenantId, true, prisma, activatedAt);
    await setClassRankingEnabled(other.tenantId, true, prisma, activatedAt);
    for (const scope of [ana, bia, intruso]) await joinClassRanking(scope, prisma, activatedAt);
    await scored(ctx, ana.studentId, "2026-10-06T12:00:00Z", 100);
    await scored(other, intruso.studentId, "2026-10-06T12:00:00Z", 999);

    await leaveClassRanking(bia, prisma, now);
    let rows = (await getClassRanking({ role: "PERSONAL", tenantId: ctx.tenantId }, "SEMANA", prisma, now)).rows;
    expect(rows.map((row) => row.name)).toEqual(["Ana"]);
    await expect(getClassRanking({ role: "ALUNO", ...bia }, "SEMANA", prisma, now)).rejects.toMatchObject({ kind: "PROIBIDO" });

    await prisma.student.update({ where: { id: ana.studentId }, data: { status: "VINCULO_ENCERRADO" } });
    rows = (await getClassRanking({ role: "PERSONAL", tenantId: ctx.tenantId }, "SEMANA", prisma, now)).rows;
    expect(rows).toEqual([]);
  });

  it("religar começa uma temporada nova", async () => {
    const ctx = await space();
    const ana = await student(ctx, "Ana");
    await setClassRankingEnabled(ctx.tenantId, true, prisma, activatedAt);
    await joinClassRanking(ana, prisma, activatedAt);
    await scored(ctx, ana.studentId, "2026-10-06T12:00:00Z", 100);
    await setClassRankingEnabled(ctx.tenantId, false, prisma, new Date("2026-10-07T00:00:00Z"));
    await setClassRankingEnabled(ctx.tenantId, true, prisma, new Date("2026-10-08T00:00:00Z"));
    expect((await getClassRanking({ role: "PERSONAL", tenantId: ctx.tenantId }, "SEMANA", prisma, now)).rows[0]).toMatchObject({ pointsTenths: 0 });
  });
});
