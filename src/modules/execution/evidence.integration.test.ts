// @vitest-environment node
//
// Foto de evidência do treino (Fase 0) contra PostgreSQL real: só de quem
// treinou, sem duplicar, com limite por treino, leitura pelo personal do
// espaço e nunca de outro espaço. Também o modo e as datas da sessão.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { startOrResumeFreeWorkoutSession } from "./freeWorkout";
import { EVIDENCE_MAX_PER_SESSION, addSessionEvidence, deleteSessionEvidence, evidenceCounts, getEvidenceForViewer, listSessionEvidence, sessionPerformedAt } from "./evidence";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  const tenant = { tenant: { name: { contains: run } } };
  await prisma.workoutSession.deleteMany({ where: tenant });
  await prisma.workout.deleteMany({ where: tenant });
  await prisma.student.deleteMany({ where: tenant });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

/// JPEG mínimo (cabeçalho basta para a detecção de tipo) com um byte que muda.
const jpeg = (seed: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, seed, 1, 2, 3]);

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `livre-${label}-${run}@example.test`, name: `Livre ${label}`, role: "INDIVIDUAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  const student = await ensureStudentForIndividual(tenant, prisma);
  const self = { tenantId: tenant.id, studentId: student.id, userId: owner.id };
  const session = await startOrResumeFreeWorkoutSession({ tenantId: tenant.id, studentId: student.id }, prisma);
  return { self, session };
}

describe("evidência do treino", () => {
  it("guarda, não duplica a mesma foto, limita por treino e só o dono exclui", async () => {
    const { self, session } = await setup("a");
    const first = await addSessionEvidence({ ...self, sessionId: session.id, bytes: jpeg(1), width: 1080, height: 1440 }, prisma);
    expect(first.created).toBe(true);
    const again = await addSessionEvidence({ ...self, sessionId: session.id, bytes: jpeg(1), width: 1080, height: 1440 }, prisma);
    expect(again).toEqual({ evidence: first.evidence, created: false });

    // Envios em paralelo não passam do limite.
    const results = await Promise.allSettled([2, 3, 4, 5].map((seed) => addSessionEvidence({ ...self, sessionId: session.id, bytes: jpeg(seed), width: 10, height: 10 }, prisma)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(EVIDENCE_MAX_PER_SESSION - 1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { kind: "VALIDACAO" } });
    expect(await listSessionEvidence(self, session.id, prisma)).toHaveLength(EVIDENCE_MAX_PER_SESSION);
    expect((await evidenceCounts(self.tenantId, [session.id], prisma)).get(session.id)).toBe(EVIDENCE_MAX_PER_SESSION);

    expect(await deleteSessionEvidence(self, first.evidence.id, prisma)).toEqual({ sessionId: session.id, remaining: EVIDENCE_MAX_PER_SESSION - 1 });
  });

  it("valida o arquivo e o tamanho; nunca no treino de outra pessoa", async () => {
    const { self, session } = await setup("b");
    const other = await setup("c");
    await expect(addSessionEvidence({ ...self, sessionId: session.id, bytes: new TextEncoder().encode("<svg/>"), width: 10, height: 10 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(addSessionEvidence({ ...self, sessionId: session.id, bytes: jpeg(1), width: 0, height: 10 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(addSessionEvidence({ ...self, sessionId: other.session.id, bytes: jpeg(1), width: 10, height: 10 }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });

    const mine = await addSessionEvidence({ ...self, sessionId: session.id, bytes: jpeg(9), width: 10, height: 10 }, prisma);
    expect(await getEvidenceForViewer({ role: "INDIVIDUAL", tenantId: self.tenantId }, mine.evidence.id, prisma)).toMatchObject({ mimeType: "image/jpeg" });
    expect(await getEvidenceForViewer({ role: "INDIVIDUAL", tenantId: other.self.tenantId }, mine.evidence.id, prisma)).toBeNull();
    expect(await getEvidenceForViewer({ role: "ALUNO", tenantId: self.tenantId, studentId: other.self.studentId }, mine.evidence.id, prisma)).toBeNull();
    await expect(deleteSessionEvidence(other.self, mine.evidence.id, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("sessão: LIVE por padrão, registrada quando começou; retroativo exige a data da realização", async () => {
    const { self, session } = await setup("d");
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row).toMatchObject({ mode: "LIVE", performedAt: null, declaredDurationSeconds: null });
    expect(sessionPerformedAt(row)).toEqual(row.startedAt);
    const performedAt = new Date("2026-10-07T21:30:00Z");
    expect(sessionPerformedAt({ ...row, performedAt })).toEqual(performedAt);

    await expect(prisma.workoutSession.update({ where: { id: session.id }, data: { mode: "RETROATIVO" } })).rejects.toThrow();
    await expect(prisma.workoutSession.update({ where: { id: session.id }, data: { declaredDurationSeconds: 0 } })).rejects.toThrow();
    const retro = await prisma.workoutSession.update({ where: { id: session.id }, data: { mode: "RETROATIVO", performedAt, declaredDurationSeconds: 45 * 60, operationKey: `op-${run}` } });
    expect(retro.mode).toBe("RETROATIVO");
    await expect(prisma.workoutSession.create({ data: { tenantId: self.tenantId, studentId: self.studentId, workoutId: row.workoutId, operationKey: `op-${run}` } })).rejects.toThrow(/Unique/);
  });
});
