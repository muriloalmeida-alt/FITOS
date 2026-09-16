// @vitest-environment node
//
// Testes de integração de convites (FIT-015) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { cancelInvitation, deriveAccessStatus, generateInvitation, getLatestInvitationForStudent } from "./invitations";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.invitation.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenantWithStudent(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  const student = await prisma.student.create({
    data: { tenantId: tenant.id, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
  return { owner, tenant, student };
}

describe("generateInvitation (FIT-015)", () => {
  it("gera um convite PENDENTE com validade de 7 dias e registra auditoria", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("gerar");

    const { invitation, rawToken } = await generateInvitation(
      { tenantId: tenant.id, studentId: student.id, actorUserId: owner.id },
      prisma
    );

    expect(invitation.status).toBe("PENDENTE");
    expect(rawToken.length).toBeGreaterThan(20);
    expect(invitation.tokenHash).not.toBe(rawToken);
    const daysUntilExpiry = (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);

    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "CONVITE_GERADO" } });
    expect(events).toHaveLength(1);
  });

  it("gerar um novo convite cancela o PENDENTE anterior (nunca dois convites válidos)", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("regenerar");
    const first = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const second = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const firstReloaded = await prisma.invitation.findUniqueOrThrow({ where: { id: first.invitation.id } });
    expect(firstReloaded.status).toBe("CANCELADO");
    expect(second.invitation.status).toBe("PENDENTE");
    expect(second.rawToken).not.toBe(first.rawToken);
  });

  it("rejeita gerar convite para aluno inativo", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("inativo");
    await prisma.student.update({ where: { id: student.id }, data: { status: "INATIVO" } });

    await expect(
      generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "ALUNO_INATIVO" });
  });

  it("rejeita gerar convite para aluno que já ativou a conta", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ja-ativo");
    const activatedUser = await prisma.user.create({ data: { email: student.email, name: "Já ativo", role: "ALUNO" } });
    await prisma.student.update({ where: { id: student.id }, data: { userId: activatedUser.id } });

    await expect(
      generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "CONTA_JA_ATIVADA" });
  });

  it("lança NAO_ENCONTRADO para um studentId de outro tenant", async () => {
    const tenantA = await createTenantWithStudent("gerar-outro-a");
    const tenantB = await createTenantWithStudent("gerar-outro-b");

    await expect(
      generateInvitation({ tenantId: tenantB.tenant.id, studentId: tenantA.student.id, actorUserId: tenantB.owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("cancelInvitation (FIT-015)", () => {
  it("cancela o convite pendente e registra auditoria", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("cancelar");
    const { invitation } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    await cancelInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const reloaded = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(reloaded.status).toBe("CANCELADO");
    const events = await prisma.auditEvent.findMany({ where: { entityId: student.id, action: "CONVITE_CANCELADO" } });
    expect(events).toHaveLength(1);
  });

  it("é idempotente: cancelar quando não há convite pendente não é um erro", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("cancelar-idempotente");

    await expect(cancelInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma)).resolves.toBeUndefined();
  });
});

describe("deriveAccessStatus (FIT-015)", () => {
  it("NAO_CONVIDADO: aluno sem nenhum convite", async () => {
    const { student } = await createTenantWithStudent("acesso-nao-convidado");
    expect(deriveAccessStatus(student, null)).toBe("NAO_CONVIDADO");
  });

  it("CONVITE_PENDENTE: convite válido, ainda não expirado", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("acesso-pendente");
    const { invitation } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    expect(deriveAccessStatus(student, invitation)).toBe("CONVITE_PENDENTE");
  });

  it("CONVITE_EXPIRADO: convite PENDENTE cujo prazo já passou (estado derivado, não persistido)", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("acesso-expirado");
    const { invitation } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    const expired = { ...invitation, expiresAt: new Date(Date.now() - 1000) };
    expect(deriveAccessStatus(student, expired)).toBe("CONVITE_EXPIRADO");
  });

  it("CONVITE_CANCELADO: último convite foi cancelado", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("acesso-cancelado");
    await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    await cancelInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    const latest = await getLatestInvitationForStudent({ tenantId: tenant.id, studentId: student.id }, prisma);

    expect(deriveAccessStatus(student, latest)).toBe("CONVITE_CANCELADO");
  });

  it("CONTA_ATIVA: aluno com userId preenchido, independentemente do convite", async () => {
    const { student } = await createTenantWithStudent("acesso-ativo");
    const activeStudent = { ...student, userId: "algum-user-id" };
    expect(deriveAccessStatus(activeStudent, null)).toBe("CONTA_ATIVA");
  });
});
