// @vitest-environment node
//
// Testes de integração de metas pessoais de evolução (FIT-104) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { abandonGoal, completeGoal, createGoal, listGoalsForStudent } from "./goals";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.goal.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "INDIVIDUAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type: "INDIVIDUAL" } });
  return { owner, tenant };
}

async function createStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
}

describe("createGoal (FIT-104)", () => {
  it("cria uma meta EM_ANDAMENTO, com e sem data-alvo", async () => {
    const { tenant } = await createTenant("criar");
    const student = await createStudent(tenant.id, "criar");

    const comData = await createGoal(
      { tenantId: tenant.id, studentId: student.id, description: "Perder 5kg", targetDate: new Date("2026-12-31") },
      prisma
    );
    const semData = await createGoal(
      { tenantId: tenant.id, studentId: student.id, description: "Correr 5km sem pausa", targetDate: null },
      prisma
    );

    expect(comData.status).toBe("EM_ANDAMENTO");
    expect(comData.targetDate?.toISOString()).toBe(new Date("2026-12-31").toISOString());
    expect(comData.completedAt).toBeNull();
    expect(semData.targetDate).toBeNull();
  });

  it("rejeita descrição vazia ou maior que 200 caracteres", async () => {
    const { tenant } = await createTenant("validacao");
    const student = await createStudent(tenant.id, "validacao");

    await expect(
      createGoal({ tenantId: tenant.id, studentId: student.id, description: "   ", targetDate: null }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    await expect(
      createGoal({ tenantId: tenant.id, studentId: student.id, description: "a".repeat(201), targetDate: null }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("listGoalsForStudent (FIT-104)", () => {
  it("lista mais recente primeiro e nunca a de outro tenant", async () => {
    const { tenant: tenantA } = await createTenant("listar-a");
    const { tenant: tenantB } = await createTenant("listar-b");
    const studentA = await createStudent(tenantA.id, "listar");

    const primeira = await createGoal({ tenantId: tenantA.id, studentId: studentA.id, description: "Primeira", targetDate: null }, prisma);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const segunda = await createGoal({ tenantId: tenantA.id, studentId: studentA.id, description: "Segunda", targetDate: null }, prisma);

    const lista = await listGoalsForStudent({ tenantId: tenantA.id, studentId: studentA.id }, prisma);
    expect(lista.map((g) => g.id)).toEqual([segunda.id, primeira.id]);

    const listaDeOutroTenant = await listGoalsForStudent({ tenantId: tenantB.id, studentId: studentA.id }, prisma);
    expect(listaDeOutroTenant).toHaveLength(0);
  });
});

describe("completeGoal / abandonGoal (FIT-104)", () => {
  it("conclui uma meta EM_ANDAMENTO, preenchendo completedAt", async () => {
    const { tenant } = await createTenant("concluir");
    const student = await createStudent(tenant.id, "concluir");
    const goal = await createGoal({ tenantId: tenant.id, studentId: student.id, description: "Meta", targetDate: null }, prisma);

    const concluida = await completeGoal({ tenantId: tenant.id, studentId: student.id, goalId: goal.id }, prisma);

    expect(concluida.status).toBe("CONCLUIDA");
    expect(concluida.completedAt).not.toBeNull();
  });

  it("abandona uma meta EM_ANDAMENTO, sem preencher completedAt", async () => {
    const { tenant } = await createTenant("abandonar");
    const student = await createStudent(tenant.id, "abandonar");
    const goal = await createGoal({ tenantId: tenant.id, studentId: student.id, description: "Meta", targetDate: null }, prisma);

    const abandonada = await abandonGoal({ tenantId: tenant.id, studentId: student.id, goalId: goal.id }, prisma);

    expect(abandonada.status).toBe("ABANDONADA");
    expect(abandonada.completedAt).toBeNull();
  });

  it("rejeita concluir/abandonar meta já concluída (ESTADO_INVALIDO)", async () => {
    const { tenant } = await createTenant("estado-invalido");
    const student = await createStudent(tenant.id, "estado-invalido");
    const goal = await createGoal({ tenantId: tenant.id, studentId: student.id, description: "Meta", targetDate: null }, prisma);
    await completeGoal({ tenantId: tenant.id, studentId: student.id, goalId: goal.id }, prisma);

    await expect(
      completeGoal({ tenantId: tenant.id, studentId: student.id, goalId: goal.id }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
    await expect(
      abandonGoal({ tenantId: tenant.id, studentId: student.id, goalId: goal.id }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });

  it("rejeita meta de outro tenant/aluno (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("cruzado-a");
    const { tenant: tenantB } = await createTenant("cruzado-b");
    const studentA = await createStudent(tenantA.id, "cruzado");
    const studentB = await createStudent(tenantB.id, "cruzado");
    const goal = await createGoal({ tenantId: tenantA.id, studentId: studentA.id, description: "Meta", targetDate: null }, prisma);

    await expect(
      completeGoal({ tenantId: tenantB.id, studentId: studentB.id, goalId: goal.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
