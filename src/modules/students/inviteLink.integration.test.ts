// @vitest-environment node
//
// EPIC-29: link de convite do personal; o aluno entra sozinho. PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { getInviteLink, getOrCreateInviteCode, joinByInviteLink, regenerateInviteCode } from "./inviteLink";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  user: { additionalFields: { role: { type: "string", required: true, defaultValue: "PERSONAL", input: false } } },
  advanced: { database: { generateId: false } },
});

afterAll(async () => {
  await prisma.invitation.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("link de convite (EPIC-29)", () => {
  it("o aluno entra pelo link com os próprios dados e já fica logado; o link antigo para de valer ao gerar outro", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const code = await getOrCreateInviteCode(tenant.id, prisma);
    expect(await getOrCreateInviteCode(tenant.id, prisma)).toBe(code);
    expect(await getInviteLink(code, prisma)).toEqual({ tenantId: tenant.id, businessName: `Studio ${run}`, personalName: "Murilo Almeida", cref: null });

    const result = await joinByInviteLink({ code, name: "Gabriel Nunes", email: `Gabriel-${run}@Example.test`, password: "senha-forte-123" }, prisma, testAuth);
    expect(result.headers.getSetCookie().length).toBeGreaterThan(0);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: result.studentId }, include: { user: true, invitations: true } });
    expect(student).toMatchObject({ tenantId: tenant.id, displayName: "Gabriel Nunes", status: "ATIVO" });
    expect(student.user?.role).toBe("ALUNO");
    expect(student.invitations[0]?.status).toBe("ACEITO");

    await expect(joinByInviteLink({ code, name: "Outro", email: `gabriel-${run}@example.test`, password: "senha-forte-123" }, prisma, testAuth)).rejects.toMatchObject({ kind: "EMAIL_JA_POSSUI_CONTA" });
    expect(await prisma.student.count({ where: { tenantId: tenant.id } })).toBe(1);

    const fresh = await regenerateInviteCode(tenant.id, prisma);
    expect(fresh).not.toBe(code);
    expect(await getInviteLink(code, prisma)).toBeNull();
    await expect(joinByInviteLink({ code, name: "Ana", email: `ana-${run}@example.test`, password: "senha-forte-123" }, prisma, testAuth)).rejects.toMatchObject({ kind: "LINK_INVALIDO" });
  });

  it("indicação de aluno (EPIC-47): quem entra com ?ref= de um aluno do espaço fica marcado", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-ref-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ref ${run}` } });
    const otherOwner = await prisma.user.create({ data: { email: `dono-ref2-${run}@example.test`, name: "Outro", role: "PERSONAL" } });
    const other = await prisma.tenant.create({ data: { ownerId: otherOwner.id, name: `Studio ref2 ${run}` } });
    const ana = await prisma.student.create({ data: { tenantId: tenant.id, email: `ana-ref-${run}@example.test`, displayName: "Ana Costa" } });
    const stranger = await prisma.student.create({ data: { tenantId: other.id, email: `zed-ref-${run}@example.test`, displayName: "Zed" } });
    const code = await getOrCreateInviteCode(tenant.id, prisma);

    const joined = await joinByInviteLink({ code, name: "Bia Lima", email: `bia-ref-${run}@example.test`, password: "senha-forte-123", ref: ana.id }, prisma, testAuth);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: joined.studentId } })).referredByStudentId).toBe(ana.id);

    const outsider = await joinByInviteLink({ code, name: "Caio", email: `caio-ref-${run}@example.test`, password: "senha-forte-123", ref: stranger.id }, prisma, testAuth);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: outsider.studentId } })).referredByStudentId).toBeNull();
  });
});
