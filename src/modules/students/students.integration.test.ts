// @vitest-environment node
//
// Testes de integração de FIT-013 contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createStudent, listStudents, StudentError } from "./students";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.student.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  return prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
}

describe("createStudent (FIT-013)", () => {
  it("cadastra um aluno ATIVO e sem userId (não convidado)", async () => {
    const tenant = await createTenant("normal");

    const student = await createStudent(
      { tenantId: tenant.id, name: "  Fulano de Tal  ", email: `Fulano.${run}@Example.TEST` },
      prisma
    );

    expect(student.status).toBe("ATIVO");
    expect(student.userId).toBeNull();
    expect(student.displayName).toBe("Fulano de Tal");
    expect(student.email).toBe(`fulano.${run}@example.test`);
    expect(student.tenantId).toBe(tenant.id);
  });

  it("rejeita nome vazio", async () => {
    const tenant = await createTenant("nome-vazio");
    await expect(createStudent({ tenantId: tenant.id, name: "   ", email: `x-${run}@example.test` }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });

  it("rejeita e-mail com formato inválido", async () => {
    const tenant = await createTenant("email-invalido");
    await expect(createStudent({ tenantId: tenant.id, name: "Fulano", email: "não-é-email" }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });

  it("rejeita e-mail duplicado no mesmo tenant", async () => {
    const tenant = await createTenant("duplicado");
    const email = `duplicado-${run}@example.test`;
    await createStudent({ tenantId: tenant.id, name: "Primeiro", email }, prisma);

    await expect(createStudent({ tenantId: tenant.id, name: "Segundo", email }, prisma)).rejects.toMatchObject({
      kind: "EMAIL_DUPLICADO_NO_TENANT",
    });
  });

  it("permite o mesmo e-mail em tenants diferentes, antes de qualquer ativação", async () => {
    const tenantA = await createTenant("email-compartilhado-a");
    const tenantB = await createTenant("email-compartilhado-b");
    const email = `compartilhado-${run}@example.test`;

    const studentA = await createStudent({ tenantId: tenantA.id, name: "Aluno A", email }, prisma);
    const studentB = await createStudent({ tenantId: tenantB.id, name: "Aluno B", email }, prisma);

    expect(studentA.tenantId).not.toBe(studentB.tenantId);
    expect(studentA.email).toBe(studentB.email);
  });

  it("rejeita e-mail que já pertence a uma conta existente (User), sem revelar o tenant", async () => {
    const tenant = await createTenant("conta-existente");
    const existingUser = await prisma.user.create({
      data: { email: `ja-tem-conta-${run}@example.test`, name: "Já tem conta", role: "PERSONAL" },
    });

    const promise = createStudent({ tenantId: tenant.id, name: "Tentativa", email: existingUser.email }, prisma);

    await expect(promise).rejects.toMatchObject({ kind: "EMAIL_JA_POSSUI_CONTA" });
    await expect(promise.catch((error: StudentError) => error.message)).resolves.not.toMatch(/tenant|owner|id/i);
  });
});

describe("listStudents (FIT-013)", () => {
  it("lista apenas os alunos do tenant informado (isolamento)", async () => {
    const tenantA = await createTenant("isolamento-a");
    const tenantB = await createTenant("isolamento-b");
    await createStudent({ tenantId: tenantA.id, name: "Aluno da A", email: `aluno-a-${run}@example.test` }, prisma);
    await createStudent({ tenantId: tenantB.id, name: "Aluno da B", email: `aluno-b-${run}@example.test` }, prisma);

    const resultA = await listStudents({ tenantId: tenantA.id }, prisma);

    expect(resultA.items).toHaveLength(1);
    expect(resultA.items[0]?.displayName).toBe("Aluno da A");
    expect(resultA.total).toBe(1);
  });

  it("busca por nome e por e-mail (case-insensitive, substring)", async () => {
    const tenant = await createTenant("busca");
    await createStudent({ tenantId: tenant.id, name: "Joana Pereira", email: `joana-${run}@example.test` }, prisma);
    await createStudent({ tenantId: tenant.id, name: "Marcos Silva", email: `marcos-${run}@example.test` }, prisma);

    const porNome = await listStudents({ tenantId: tenant.id, search: "joana" }, prisma);
    expect(porNome.items).toHaveLength(1);
    expect(porNome.items[0]?.displayName).toBe("Joana Pereira");

    const porEmail = await listStudents({ tenantId: tenant.id, search: `MARCOS-${run}` }, prisma);
    expect(porEmail.items).toHaveLength(1);
    expect(porEmail.items[0]?.displayName).toBe("Marcos Silva");

    const semResultado = await listStudents({ tenantId: tenant.id, search: "inexistente-xyz" }, prisma);
    expect(semResultado.items).toHaveLength(0);
    expect(semResultado.total).toBe(0);
  });

  it("filtra por status", async () => {
    const tenant = await createTenant("filtro-status");
    const ativo = await createStudent({ tenantId: tenant.id, name: "Ativo", email: `ativo-${run}@example.test` }, prisma);
    const inativo = await createStudent({ tenantId: tenant.id, name: "Inativo", email: `inativo-${run}@example.test` }, prisma);
    await prisma.student.update({ where: { id: inativo.id }, data: { status: "INATIVO" } });

    const ativos = await listStudents({ tenantId: tenant.id, status: "ATIVO" }, prisma);
    expect(ativos.items.map((item) => item.id)).toEqual([ativo.id]);

    const inativos = await listStudents({ tenantId: tenant.id, status: "INATIVO" }, prisma);
    expect(inativos.items.map((item) => item.id)).toEqual([inativo.id]);
  });

  it("pagina de forma estável, sem repetir nem pular registros", async () => {
    const tenant = await createTenant("paginacao");
    for (const letter of ["A", "B", "C", "D", "E"]) {
      await createStudent({ tenantId: tenant.id, name: `Aluno ${letter} ${run}`, email: `aluno-${letter}-${run}@example.test` }, prisma);
    }

    const page1 = await listStudents({ tenantId: tenant.id, search: run, page: 1, pageSize: 2 }, prisma);
    const page2 = await listStudents({ tenantId: tenant.id, search: run, page: 2, pageSize: 2 }, prisma);
    const page3 = await listStudents({ tenantId: tenant.id, search: run, page: 3, pageSize: 2 }, prisma);

    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page3.items).toHaveLength(1);

    const allIds = [...page1.items, ...page2.items, ...page3.items].map((item) => item.id);
    expect(new Set(allIds).size).toBe(5);
  });
});
