// @vitest-environment node
//
// Amigos (Desafios 4/4) contra PostgreSQL real: grupo por convite entre
// espaços diferentes, temporada, só pontos oficiais dentro da janela e
// depois da entrada, sair revoga a leitura e passa a organização adiante,
// e quem não é membro não vê nada.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createFriendGroup, getFriendGroup, joinFriendGroup, leaveFriendGroup, listMyFriendGroups, previewInvite, startFriendSeason } from "./friendGroups";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const start = new Date("2026-10-05T12:00:00Z");

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.friendGroup.deleteMany({ where: { name: { contains: run } } });
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.trainingPlan.deleteMany({ where: tenant });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
/// Uma pessoa que treina no próprio espaço (Livre), com um treino para pontuar.
async function person(name: string) {
  const label = `${++counter}`;
  const user = await prisma.user.create({ data: { email: `amigo-${label}-${run}@example.test`, name, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Livre ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: name } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
  return { self: { userId: user.id, tenantId: tenant.id, studentId: student.id }, workoutId: workout.id };
}

async function scored(p: Awaited<ReturnType<typeof person>>, iso: string, totalTenths: number, status: "LIBERADO" | "PENDENTE_FOTO" = "LIBERADO", releasedAt: Date | null = new Date(iso)) {
  const at = new Date(iso);
  const session = await prisma.workoutSession.create({ data: { tenantId: p.self.tenantId, studentId: p.self.studentId, workoutId: p.workoutId, status: "CONCLUIDA", startedAt: at, endedAt: at } });
  await prisma.sessionScore.create({ data: { tenantId: p.self.tenantId, studentId: p.self.studentId, sessionId: session.id, ruleVersion: 1, totalTenths, plannedItems: 4, balancedTenths: totalTenths / 4, items: [], status, releasedAt: status === "LIBERADO" ? releasedAt : null, performedAt: at, photoDeadline: at } });
}

describe("amigos", () => {
  it("cria com temporada, entra por convite, classifica só o que vale e sinaliza quem saiu", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const caio = await person("Caio");
    const group = await createFriendGroup(ana.self, { name: `Corrida ${run}`, mode: "TOTAL", lengthDays: 7 }, prisma, start);
    expect(group.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(await previewInvite(group.inviteCode.toLowerCase(), prisma, start)).toMatchObject({ name: `Corrida ${run}`, mode: "TOTAL", members: 1, season: { lengthDays: 7 } });

    await joinFriendGroup(bia.self, group.inviteCode, prisma, new Date("2026-10-06T12:00:00Z"));
    await joinFriendGroup(caio.self, ` ${group.inviteCode.slice(0, 4)}-${group.inviteCode.slice(4)} `, prisma, start);
    await scored(ana, "2026-10-05T15:00:00Z", 100);
    await scored(ana, "2026-10-04T15:00:00Z", 900); // antes da temporada
    await scored(ana, "2026-10-07T15:00:00Z", 80, "PENDENTE_FOTO"); // sem foto não conta
    await scored(bia, "2026-10-05T18:00:00Z", 500); // antes de entrar
    await scored(bia, "2026-10-08T15:00:00Z", 120);
    await scored(caio, "2026-10-06T15:00:00Z", 60);
    await leaveFriendGroup(caio.self, group.id, prisma, new Date("2026-10-07T00:00:00Z"));
    await scored(caio, "2026-10-08T15:00:00Z", 900); // depois de sair

    const now = new Date("2026-10-09T12:00:00Z");
    const view = await getFriendGroup(ana.self, group.id, prisma, now);
    expect(view).toMatchObject({ isOrganizer: true, members: 2, season: { running: true } });
    expect(view.rows.map((row) => [row.name, row.position, row.pointsTenths, row.left, row.isMe])).toEqual([
      ["Bia", 1, 120, false, false],
      ["Ana", 2, 100, false, true],
      ["Caio", 3, 60, true, false],
    ]);
    // Só nome, foto e pontos: nada de carga, programa ou foto do treino.
    expect(Object.keys(view.rows[0]!).sort()).toEqual(["contested", "counted", "image", "isMe", "left", "memberId", "name", "pointsTenths", "position"]);

    // Quem saiu (ou nunca entrou) não vê o grupo.
    await expect(getFriendGroup(caio.self, group.id, prisma, now)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    const stranger = await person("Estranho");
    await expect(getFriendGroup(stranger.self, group.id, prisma, now)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    expect((await listMyFriendGroups(bia.self, prisma, now)).map((summary) => [summary.name, summary.myPosition])).toEqual([[`Corrida ${run}`, 1]]);
  });

  it("temporada: só o organizador, uma de cada vez; ao sair, a organização passa adiante", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const group = await createFriendGroup(ana.self, { name: `Força ${run}`, mode: "EQUILIBRADO", lengthDays: 7 }, prisma, start);
    await joinFriendGroup(bia.self, group.inviteCode, prisma, start);
    const during = new Date("2026-10-08T12:00:00Z");
    await expect(startFriendSeason(ana.self, group.id, 14, prisma, during)).rejects.toMatchObject({ kind: "CONFLITO" });
    await expect(startFriendSeason(bia.self, group.id, 14, prisma, new Date("2026-10-13T12:00:00Z"))).rejects.toMatchObject({ kind: "PROIBIDO" });
    await expect(startFriendSeason(ana.self, group.id, 10, prisma, new Date("2026-10-13T12:00:00Z"))).rejects.toMatchObject({ kind: "VALIDACAO" });
    const next = await startFriendSeason(ana.self, group.id, 14, prisma, new Date("2026-10-13T12:00:00Z"));
    expect(next.endsAt.toISOString()).toBe("2026-10-27T12:00:00.000Z");

    await leaveFriendGroup(ana.self, group.id, prisma, during);
    expect((await getFriendGroup(bia.self, group.id, prisma, during)).isOrganizer).toBe(true);
    // Voltar recomeça como membro.
    await joinFriendGroup(ana.self, group.inviteCode, prisma, during);
    expect((await getFriendGroup(ana.self, group.id, prisma, during)).isOrganizer).toBe(false);
  });

  it("valida nome, modo e convite; temporada encerrada não pega pontos liberados depois da consolidação", async () => {
    const ana = await person("Ana");
    await expect(createFriendGroup(ana.self, { name: "A", mode: "TOTAL", lengthDays: 7 }, prisma, start)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(createFriendGroup(ana.self, { name: `Grupo ${run}`, mode: "OUTRO", lengthDays: 7 }, prisma, start)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(joinFriendGroup(ana.self, "NAOEXISTE", prisma, start)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    expect(await previewInvite("NAOEXISTE", prisma, start)).toBeNull();

    const group = await createFriendGroup(ana.self, { name: `Fechada ${run}`, mode: "TOTAL", lengthDays: 7 }, prisma, start);
    await scored(ana, "2026-10-06T15:00:00Z", 100);
    await scored(ana, "2026-10-07T15:00:00Z", 300, "LIBERADO", new Date("2026-10-15T12:00:00Z")); // foto depois da consolidação
    const view = await getFriendGroup(ana.self, group.id, prisma, new Date("2026-10-20T12:00:00Z"));
    expect(view.season?.running).toBe(false);
    expect(view.rows[0]?.pointsTenths).toBe(100);
  });
});
