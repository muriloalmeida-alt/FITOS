// @vitest-environment node
//
// Testes de integração de avaliação e evolução (FIT-042) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createAssessment, listAssessmentsForStudent, softDeleteAssessment } from "./assessments";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.bodyMeasurement.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.assessment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function createStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
}

describe("createAssessment (FIT-042)", () => {
  it("registra peso, gordura, observação e medidas, convertendo para as unidades de armazenamento", async () => {
    const { tenant, owner } = await createTenant("criar");
    const student = await createStudent(tenant.id, "criar");

    const assessment = await createAssessment(
      {
        tenantId: tenant.id,
        actorUserId: owner.id,
        studentId: student.id,
        weightKg: 82.5,
        bodyFatPercent: 18.5,
        notes: "Evolução consistente",
        measurementsCm: [
          { type: "CINTURA", valueCm: 85.5 },
          { type: "BRACO", valueCm: 36 },
        ],
      },
      prisma
    );

    expect(assessment.weightGrams).toBe(82500);
    expect(assessment.bodyFatTenthPercent).toBe(185);
    expect(assessment.notes).toBe("Evolução consistente");
    expect(assessment.authorUserId).toBe(owner.id);
    expect(assessment.deletedAt).toBeNull();
    expect(assessment.measurements).toHaveLength(2);
    expect(assessment.measurements.find((m) => m.type === "CINTURA")?.valueMillimeters).toBe(855);
    expect(assessment.measurements.find((m) => m.type === "BRACO")?.valueMillimeters).toBe(360);
  });

  it("aceita uma avaliação sem nenhum campo opcional (todos null/vazio)", async () => {
    const { tenant, owner } = await createTenant("minima");
    const student = await createStudent(tenant.id, "minima");

    const assessment = await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: null, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );

    expect(assessment.weightGrams).toBeNull();
    expect(assessment.bodyFatTenthPercent).toBeNull();
    expect(assessment.notes).toBeNull();
    expect(assessment.measurements).toHaveLength(0);
  });

  it("rejeita peso, gordura e medidas não positivos", async () => {
    const { tenant, owner } = await createTenant("nao-positivo");
    const student = await createStudent(tenant.id, "nao-positivo");

    await expect(
      createAssessment(
        { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: -1, bodyFatPercent: null, notes: null, measurementsCm: [] },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    await expect(
      createAssessment(
        { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: null, bodyFatPercent: 0, notes: null, measurementsCm: [] },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    await expect(
      createAssessment(
        {
          tenantId: tenant.id,
          actorUserId: owner.id,
          studentId: student.id,
          weightKg: null,
          bodyFatPercent: null,
          notes: null,
          measurementsCm: [{ type: "CINTURA", valueCm: -5 }],
        },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });

  it("rejeita aluno que não pertence ao tenant informado", async () => {
    const { tenant: tenantA, owner } = await createTenant("aluno-cruzado-a");
    const { tenant: tenantB } = await createTenant("aluno-cruzado-b");
    const studentB = await createStudent(tenantB.id, "aluno-cruzado");

    await expect(
      createAssessment(
        { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentB.id, weightKg: 70, bodyFatPercent: null, notes: null, measurementsCm: [] },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("listAssessmentsForStudent (FIT-042)", () => {
  it("lista mais recente primeiro e nunca inclui avaliação excluída logicamente", async () => {
    const { tenant, owner } = await createTenant("listar");
    const student = await createStudent(tenant.id, "listar");

    const primeira = await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: 80, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const segunda = await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: 79, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );
    const terceira = await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: 78, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );
    await softDeleteAssessment({ tenantId: tenant.id, actorUserId: owner.id, assessmentId: segunda.id }, prisma);

    const lista = await listAssessmentsForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(lista.map((a) => a.id)).toEqual([terceira.id, primeira.id]);
  });

  it("isolamento: nunca lista avaliação de aluno de outro tenant", async () => {
    const { tenant: tenantA, owner } = await createTenant("isolamento-a");
    const { tenant: tenantB } = await createTenant("isolamento-b");
    const studentA = await createStudent(tenantA.id, "isolamento");
    await createAssessment(
      { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentA.id, weightKg: 80, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );

    const listaDeOutroTenant = await listAssessmentsForStudent({ tenantId: tenantB.id, studentId: studentA.id }, prisma);

    expect(listaDeOutroTenant).toHaveLength(0);
  });
});

describe("softDeleteAssessment (FIT-042)", () => {
  it("marca deletedAt/deletedByUserId, registra AuditEvent, e é idempotente", async () => {
    const { tenant, owner } = await createTenant("excluir");
    const student = await createStudent(tenant.id, "excluir");
    const assessment = await createAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, studentId: student.id, weightKg: 80, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );

    const excluida = await softDeleteAssessment({ tenantId: tenant.id, actorUserId: owner.id, assessmentId: assessment.id }, prisma);

    expect(excluida.deletedAt).not.toBeNull();
    expect(excluida.deletedByUserId).toBe(owner.id);
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "Assessment", entityId: assessment.id } });
    expect(audit?.action).toBe("AVALIACAO_EXCLUIDA");

    const segundaExclusao = await softDeleteAssessment(
      { tenantId: tenant.id, actorUserId: owner.id, assessmentId: assessment.id },
      prisma
    );
    expect(segundaExclusao.deletedAt?.getTime()).toBe(excluida.deletedAt?.getTime());

    // Nunca uma exclusão física.
    const aindaExiste = await prisma.assessment.findUnique({ where: { id: assessment.id } });
    expect(aindaExiste).not.toBeNull();
  });

  it("rejeita excluir avaliação de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA, owner } = await createTenant("excluir-cruzado-a");
    const { tenant: tenantB, owner: ownerB } = await createTenant("excluir-cruzado-b");
    const studentA = await createStudent(tenantA.id, "excluir-cruzado");
    const assessment = await createAssessment(
      { tenantId: tenantA.id, actorUserId: owner.id, studentId: studentA.id, weightKg: 80, bodyFatPercent: null, notes: null, measurementsCm: [] },
      prisma
    );

    await expect(
      softDeleteAssessment({ tenantId: tenantB.id, actorUserId: ownerB.id, assessmentId: assessment.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
