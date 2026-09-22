// @vitest-environment node
//
// Testes de integração de FIT-013 contra PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  createStudent,
  endStudentBond,
  getStudentForTenant,
  inactivateStudent,
  listStudents,
  reactivateStudent,
  StudentError,
  updateStudent,
} from "./students";

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

describe("getStudentForTenant (FIT-014)", () => {
  it("retorna null quando o aluno pertence a outro tenant", async () => {
    const tenantA = await createTenant("perfil-isolamento-a");
    const tenantB = await createTenant("perfil-isolamento-b");
    const student = await createStudent({ tenantId: tenantA.id, name: "Aluno A", email: `perfil-a-${run}@example.test` }, prisma);

    const fromOwnTenant = await getStudentForTenant({ tenantId: tenantA.id, studentId: student.id }, prisma);
    const fromOtherTenant = await getStudentForTenant({ tenantId: tenantB.id, studentId: student.id }, prisma);

    expect(fromOwnTenant?.id).toBe(student.id);
    expect(fromOtherTenant).toBeNull();
  });
});

describe("updateStudent (FIT-014)", () => {
  it("edita o nome, normaliza e registra auditoria", async () => {
    const tenant = await createTenant("editar-nome");
    const student = await createStudent({ tenantId: tenant.id, name: "Nome Antigo", email: `editar-nome-${run}@example.test` }, prisma);

    const updated = await updateStudent(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, name: "  Nome Novo  " },
      prisma
    );

    expect(updated.displayName).toBe("Nome Novo");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "ALUNO_EDITADO" } });
    expect(events).toHaveLength(1);
  });

  it("edita o e-mail antes da ativação (userId nulo)", async () => {
    const tenant = await createTenant("editar-email-pre-ativacao");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `antigo-${run}@example.test` }, prisma);
    expect(student.userId).toBeNull();

    const updated = await updateStudent(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, email: `Novo-${run}@Example.TEST` },
      prisma
    );

    expect(updated.email).toBe(`novo-${run}@example.test`);
  });

  it("bloqueia a edição de e-mail depois da ativação (userId presente)", async () => {
    const tenant = await createTenant("editar-email-pos-ativacao");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `ativado-${run}@example.test` }, prisma);
    const activatedUser = await prisma.user.create({
      data: { email: student.email, name: "Aluno", role: "ALUNO" },
    });
    await prisma.student.update({ where: { id: student.id }, data: { userId: activatedUser.id } });

    await expect(
      updateStudent(
        { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, email: `outro-${run}@example.test` },
        prisma
      )
    ).rejects.toMatchObject({ kind: "EMAIL_BLOQUEADO_POS_ATIVACAO" });
  });

  it("permite salvar o mesmo e-mail já ativado, sem bloquear (não é uma troca)", async () => {
    const tenant = await createTenant("editar-mesmo-email-pos-ativacao");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `mesmo-${run}@example.test` }, prisma);
    const activatedUser = await prisma.user.create({
      data: { email: student.email, name: "Aluno", role: "ALUNO" },
    });
    await prisma.student.update({ where: { id: student.id }, data: { userId: activatedUser.id } });

    const updated = await updateStudent(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, name: "Novo Nome", email: student.email },
      prisma
    );

    expect(updated.displayName).toBe("Novo Nome");
    expect(updated.email).toBe(student.email);
  });

  it("rejeita e-mail duplicado no mesmo tenant ao editar", async () => {
    const tenant = await createTenant("editar-duplicado");
    await createStudent({ tenantId: tenant.id, name: "Primeiro", email: `primeiro-${run}@example.test` }, prisma);
    const segundo = await createStudent({ tenantId: tenant.id, name: "Segundo", email: `segundo-${run}@example.test` }, prisma);

    await expect(
      updateStudent(
        { tenantId: tenant.id, studentId: segundo.id, actorUserId: tenant.ownerId, email: `primeiro-${run}@example.test` },
        prisma
      )
    ).rejects.toMatchObject({ kind: "EMAIL_DUPLICADO_NO_TENANT" });
  });

  it("lança NAO_ENCONTRADO para um studentId de outro tenant (sem revelar o dado)", async () => {
    const tenantA = await createTenant("editar-outro-tenant-a");
    const tenantB = await createTenant("editar-outro-tenant-b");
    const student = await createStudent({ tenantId: tenantA.id, name: "Aluno A", email: `outro-tenant-${run}@example.test` }, prisma);

    await expect(
      updateStudent({ tenantId: tenantB.id, studentId: student.id, actorUserId: tenantB.ownerId, name: "Tentativa" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("inactivateStudent / reactivateStudent (FIT-014)", () => {
  it("inativa um aluno ativo e registra auditoria", async () => {
    const tenant = await createTenant("inativar");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `inativar-${run}@example.test` }, prisma);

    const updated = await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    expect(updated.status).toBe("INATIVO");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "ALUNO_INATIVADO" } });
    expect(events).toHaveLength(1);
  });

  it("é idempotente: inativar um aluno já inativo não gera novo evento", async () => {
    const tenant = await createTenant("inativar-idempotente");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `inativar-idem-${run}@example.test` }, prisma);
    await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    const second = await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    expect(second.status).toBe("INATIVO");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "ALUNO_INATIVADO" } });
    expect(events).toHaveLength(1);
  });

  it("reativa um aluno inativo e registra auditoria", async () => {
    const tenant = await createTenant("reativar");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `reativar-${run}@example.test` }, prisma);
    await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    const updated = await reactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    expect(updated.status).toBe("ATIVO");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "ALUNO_REATIVADO" } });
    expect(events).toHaveLength(1);
  });

  it("é idempotente: reativar um aluno já ativo não gera novo evento", async () => {
    const tenant = await createTenant("reativar-idempotente");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `reativar-idem-${run}@example.test` }, prisma);

    const updated = await reactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    expect(updated.status).toBe("ATIVO");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "ALUNO_REATIVADO" } });
    expect(events).toHaveLength(0);
  });

  it("aluno inativado some da listagem padrão (status ATIVO) mas aparece com filtro explícito", async () => {
    const tenant = await createTenant("inativo-listagem");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno Inativado", email: `inativo-lista-${run}@example.test` }, prisma);
    await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    const somenteAtivos = await listStudents({ tenantId: tenant.id, status: "ATIVO" }, prisma);
    const somenteInativos = await listStudents({ tenantId: tenant.id, status: "INATIVO" }, prisma);

    expect(somenteAtivos.items.find((item) => item.id === student.id)).toBeUndefined();
    expect(somenteInativos.items.find((item) => item.id === student.id)).toBeDefined();
  });

  it("lança NAO_ENCONTRADO para um studentId de outro tenant", async () => {
    const tenantA = await createTenant("lifecycle-outro-tenant-a");
    const tenantB = await createTenant("lifecycle-outro-tenant-b");
    const student = await createStudent({ tenantId: tenantA.id, name: "Aluno A", email: `lifecycle-${run}@example.test` }, prisma);

    await expect(
      inactivateStudent({ tenantId: tenantB.id, studentId: student.id, actorUserId: tenantB.ownerId }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("endStudentBond (FIT-106)", () => {
  it("encerra um vínculo ATIVO com motivo, registrando data/motivo/autor e auditoria", async () => {
    const tenant = await createTenant("encerrar");
    const student = await createStudent({ tenantId: tenant.id, name: "Aluno", email: `encerrar-${run}@example.test` }, prisma);

    const updated = await endStudentBond(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: "Mudança de cidade" },
      prisma
    );

    expect(updated.status).toBe("VINCULO_ENCERRADO");
    expect(updated.endedAt).not.toBeNull();
    expect(updated.endReason).toBe("Mudança de cidade");
    expect(updated.endedByUserId).toBe(tenant.ownerId);
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "VINCULO_ENCERRADO" } });
    expect(events).toHaveLength(1);
  });

  it("encerra um vínculo INATIVO e aceita motivo nulo/vazio", async () => {
    const tenant = await createTenant("encerrar-de-inativo");
    const student = await createStudent(
      { tenantId: tenant.id, name: "Aluno", email: `encerrar-inativo-${run}@example.test` },
      prisma
    );
    await inactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma);

    const updated = await endStudentBond(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: "   " },
      prisma
    );

    expect(updated.status).toBe("VINCULO_ENCERRADO");
    expect(updated.endReason).toBeNull();
  });

  it("é idempotente: encerrar um vínculo já encerrado não gera novo evento nem sobrescreve o motivo original", async () => {
    const tenant = await createTenant("encerrar-idempotente");
    const student = await createStudent(
      { tenantId: tenant.id, name: "Aluno", email: `encerrar-idem-${run}@example.test` },
      prisma
    );
    const first = await endStudentBond(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: "Motivo original" },
      prisma
    );

    const second = await endStudentBond(
      { tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: "Outro motivo" },
      prisma
    );

    expect(second.endReason).toBe("Motivo original");
    expect(second.endedAt?.getTime()).toBe(first.endedAt?.getTime());
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "VINCULO_ENCERRADO" } });
    expect(events).toHaveLength(1);
  });

  it("rejeita motivo maior que 500 caracteres", async () => {
    const tenant = await createTenant("encerrar-motivo-longo");
    const student = await createStudent(
      { tenantId: tenant.id, name: "Aluno", email: `encerrar-longo-${run}@example.test` },
      prisma
    );

    await expect(
      endStudentBond({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: "a".repeat(501) }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });

  it("lança NAO_ENCONTRADO para um studentId de outro tenant", async () => {
    const tenantA = await createTenant("encerrar-outro-tenant-a");
    const tenantB = await createTenant("encerrar-outro-tenant-b");
    const student = await createStudent({ tenantId: tenantA.id, name: "Aluno A", email: `encerrar-cruzado-${run}@example.test` }, prisma);

    await expect(
      endStudentBond({ tenantId: tenantB.id, studentId: student.id, actorUserId: tenantB.ownerId, reason: null }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("rejeita reativar um vínculo encerrado (ESTADO_INVALIDO), diferente de INATIVO", async () => {
    const tenant = await createTenant("encerrar-nunca-reabre");
    const student = await createStudent(
      { tenantId: tenant.id, name: "Aluno", email: `encerrar-nunca-reabre-${run}@example.test` },
      prisma
    );
    await endStudentBond({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId, reason: null }, prisma);

    await expect(
      reactivateStudent({ tenantId: tenant.id, studentId: student.id, actorUserId: tenant.ownerId }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });
});
