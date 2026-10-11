// @vitest-environment node
//
// Contestação (Desafios 4/4, parte B) contra PostgreSQL real: contestar
// pelo resumo mínimo, pontos valendo até a decisão, revisor certo (outra
// pessoa quando o treino é do organizador), sem duplicar, decisão auditada,
// anulação tira do placar, recurso uma vez, e a foto só para o revisor.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createFriendGroup, getFriendGroup, joinFriendGroup } from "./friendGroups";
import { appealContest, contestStateForAuthor, decideContest, evidenceForReviewer, listReviewQueue, openContest, workoutsForContest } from "./scoreContests";
import { joinClassRanking, setClassRankingEnabled } from "./classRanking";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const start = new Date("2026-10-05T12:00:00Z");
const released = new Date("2026-10-06T15:00:00Z");
const soon = new Date("2026-10-06T20:00:00Z");

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
async function person(name: string) {
  const label = `${++counter}`;
  const user = await prisma.user.create({ data: { email: `c-${label}-${run}@example.test`, name, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Livre ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: name } });
  const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
  const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
  return { self: { userId: user.id, tenantId: tenant.id, studentId: student.id }, workoutId: workout.id };
}

async function scored(owner: { self: { userId: string; tenantId: string; studentId: string }; workoutId: string }, totalTenths = 100) {
  const session = await prisma.workoutSession.create({ data: { tenantId: owner.self.tenantId, studentId: owner.self.studentId, workoutId: owner.workoutId, status: "CONCLUIDA", startedAt: released, endedAt: released } });
  await prisma.workoutEvidencePhoto.create({ data: { tenantId: owner.self.tenantId, sessionId: session.id, uploadedById: owner.self.userId, sha256: `${session.id}`.padEnd(64, "0"), mimeType: "image/jpeg", sizeBytes: 3, width: 1, height: 1, data: Buffer.from([1, 2, 3]) } });
  return prisma.sessionScore.create({ data: { tenantId: owner.self.tenantId, studentId: owner.self.studentId, sessionId: session.id, ruleVersion: 1, totalTenths, plannedItems: 1, balancedTenths: totalTenths, items: [], status: "LIBERADO", releasedAt: released, performedAt: released, photoDeadline: released } });
}

async function friends() {
  const ana = await person("Ana");
  const bia = await person("Bia");
  const caio = await person("Caio");
  const duda = await person("Duda");
  const group = await createFriendGroup(ana.self, { name: `Grupo ${run} ${counter}`, mode: "TOTAL", lengthDays: 7 }, prisma, start);
  await joinFriendGroup(bia.self, group.inviteCode, prisma, start);
  await joinFriendGroup(caio.self, group.inviteCode, prisma, start);
  await joinFriendGroup(duda.self, group.inviteCode, prisma, new Date(start.getTime() + 1000));
  return { ana, bia, caio, duda, group, target: { context: "AMIGOS" as const, groupId: group.id } };
}

describe("contestação", () => {
  it("contesta, pontos seguem valendo em contestação, organizador anula com justificativa e o placar perde os pontos", async () => {
    const { ana, bia, caio, duda, group, target } = await friends();
    const score = await scored(bia, 300);
    expect((await workoutsForContest(bia.self, { from: start, until: new Date("2026-10-12T12:00:00Z") }, prisma, soon))[0]).toMatchObject({ scoreId: score.id, pointsTenths: 300, contestable: true });

    const contest = await openContest(caio.self, target, score.id, "Foto não mostra treino nenhum", prisma, soon);
    expect(contest).toMatchObject({ reviewerUserId: ana.self.userId, status: "ABERTA" });
    const during = await getFriendGroup(ana.self, group.id, prisma, soon);
    expect(during.rows.find((row) => row.name === "Bia")).toMatchObject({ pointsTenths: 300, contested: true });

    // Sem duplicar: nem o mesmo, nem outra pessoa enquanto está aberto.
    await expect(openContest(caio.self, target, score.id, "De novo, mesma coisa", prisma, soon)).rejects.toMatchObject({ kind: "CONFLITO" });
    await expect(openContest(ana.self, target, score.id, "Também acho estranho", prisma, soon)).rejects.toMatchObject({ kind: "CONFLITO" });

    // Só o revisor vê a foto e decide.
    const [evidence] = await prisma.workoutEvidencePhoto.findMany({ where: { sessionId: score.sessionId } });
    expect(await evidenceForReviewer(ana.self, evidence!.id, prisma)).not.toBeNull();
    expect(await evidenceForReviewer(caio.self, evidence!.id, prisma)).toBeNull();
    expect((await listReviewQueue(ana.self, target, prisma)).map((item) => [item.ownerName, item.pointsTenths, item.reason, item.evidenceIds.length])).toEqual([["Bia", 300, "Foto não mostra treino nenhum", 1]]);
    await expect(decideContest(caio.self, contest.id, "ANULADO", "Não sou o revisor", prisma, soon)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(decideContest(ana.self, contest.id, "ANULADO", "ok", prisma, soon)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await decideContest(ana.self, contest.id, "ANULADO", "A foto é de outro dia", prisma, soon);

    const after = await getFriendGroup(ana.self, group.id, prisma, soon);
    expect(after.rows.find((row) => row.name === "Bia")?.pointsTenths).toBe(0);
    expect(await evidenceForReviewer(ana.self, evidence!.id, prisma)).toBeNull();
    const events = await prisma.scoreEvent.findMany({ where: { sessionScoreId: score.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.kind, event.actorId, event.reason])).toEqual([
      ["CONTESTADO", caio.self.userId, "Foto não mostra treino nenhum"],
      ["ANULADO", ana.self.userId, "A foto é de outro dia"],
    ]);

    // O autor vê a decisão (não quem contestou) e recorre uma vez, para outro revisor.
    expect(await contestStateForAuthor(bia.self, score.sessionId, prisma, soon)).toEqual({ status: "ANULADO", isAppeal: false, decision: "A foto é de outro dia", canAppeal: true });
    const appeal = await appealContest(bia.self, score.id, "Treinei sim, a foto é do dia", prisma, soon);
    // Autora (Bia), quem contestou (Caio) e quem decidiu (Ana) ficam de fora: vai para a Duda.
    expect(appeal).toMatchObject({ isAppeal: true, reviewerUserId: duda.self.userId });
    await decideContest({ userId: appeal.reviewerUserId }, appeal.id, "MANTIDO", "Conferido, vale", prisma, soon);
    expect((await prisma.sessionScore.findUniqueOrThrow({ where: { id: score.id } })).status).toBe("MANTIDO");
    await expect(appealContest(bia.self, score.id, "Mais uma vez, por favor", prisma, soon)).rejects.toMatchObject({ kind: "CONFLITO" });
    // Mantido não volta a ser contestado.
    await expect(openContest(ana.self, target, score.id, "Ainda acho estranho", prisma, soon)).rejects.toMatchObject({ kind: "CONFLITO" });
  });

  it("treino do organizador vai para outra pessoa; prazo de 24 h; nunca o próprio; fora do grupo não acha", async () => {
    const { ana, bia, caio, target } = await friends();
    const anaScore = await scored(ana);
    const contest = await openContest(bia.self, target, anaScore.id, "Treino muito longo pra foto", prisma, soon);
    expect(contest.reviewerUserId).toBe(caio.self.userId);

    const late = await scored(caio);
    await expect(openContest(bia.self, target, late.id, "Treino suspeito demais", prisma, new Date("2026-10-07T16:00:00Z"))).rejects.toMatchObject({ kind: "CONFLITO" });
    await expect(openContest(caio.self, target, late.id, "Meu próprio treino aqui", prisma, soon)).rejects.toMatchObject({ kind: "VALIDACAO" });
    const stranger = await person("Estranho");
    await expect(openContest(stranger.self, target, late.id, "Nem estou no grupo", prisma, soon)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("turma: o personal revisa; aluno fora do ranking não contesta", async () => {
    const personal = await prisma.user.create({ data: { email: `p-${run}@example.test`, name: "Personal", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: personal.id, name: `Espaço ${run}` } });
    const plan = await prisma.trainingPlan.create({ data: { tenantId: tenant.id, name: "P", isSnapshot: false } });
    const workout = await prisma.workout.create({ data: { tenantId: tenant.id, trainingPlanId: plan.id, name: "A", position: 0 } });
    const aluno = async (name: string) => {
      const user = await prisma.user.create({ data: { email: `a-${name}-${run}@example.test`, name, role: "ALUNO" } });
      const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: name } });
      return { self: { userId: user.id, tenantId: tenant.id, studentId: student.id }, workoutId: workout.id };
    };
    const dani = await aluno("Dani");
    const edu = await aluno("Edu");
    await setClassRankingEnabled(tenant.id, true, prisma, start);
    await joinClassRanking(dani.self, prisma, start);
    const score = await scored(edu);
    await expect(openContest(dani.self, { context: "TURMA" }, score.id, "Pontos estranhos demais", prisma, soon)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await joinClassRanking(edu.self, prisma, start);
    const contest = await openContest(dani.self, { context: "TURMA" }, score.id, "Pontos estranhos demais", prisma, soon);
    expect(contest).toMatchObject({ context: "TURMA", reviewerUserId: personal.id, classTenantId: tenant.id });
    expect((await listReviewQueue({ userId: personal.id }, { context: "TURMA" }, prisma)).map((item) => item.where)).toEqual(["Ranking da turma"]);
  });
});
