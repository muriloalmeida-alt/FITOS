// @vitest-environment node
//
// FIT-151 (EPIC-20): saídas da tela "Sem vínculo" — entrar com código de
// convite na própria conta e "Treinar por conta própria".
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { hashInvitationToken } from "@/modules/students/invitations";
import { StudentAccountError, invitationTokenFromCode, joinPersonalWithInvitation, switchToIndividual } from "./studentAccount";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.invitation.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function personal(label: string) {
  const owner = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: label, role: "PERSONAL" } });
  return prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}` } });
}

async function exStudent(label: string, status: "ATIVO" | "INATIVO" | "VINCULO_ENCERRADO") {
  const tenant = await personal(`antigo-${label}`);
  const user = await prisma.user.create({ data: { email: `aluno-${label}-${run}@example.test`, name: "Ana", role: "ALUNO" } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `aluno-${label}-${run}@example.test`, displayName: "Ana", userId: user.id, status } });
  return { user, student };
}

async function invite(label: string, token: string, extra: Record<string, unknown> = {}) {
  const tenant = await personal(`novo-${label}`);
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `novo-${label}-${run}@example.test`, displayName: "Ana" } });
  await prisma.invitation.create({ data: { tenantId: tenant.id, studentId: student.id, tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + 86_400_000), ...extra } });
  return { tenant, student };
}

describe("joinPersonalWithInvitation (FIT-151)", () => {
  it("liga a conta ao novo aluno pelo link do convite e solta o vínculo encerrado, sem apagá-lo", async () => {
    const { user, student: old } = await exStudent("join", "VINCULO_ENCERRADO");
    const token = `tok-${run}-join`;
    const { student } = await invite("join", token);

    await joinPersonalWithInvitation({ userId: user.id, code: `https://fitos.app/ativar-conta?token=${token}` }, prisma);

    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).userId).toBe(user.id);
    expect(await prisma.student.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ userId: null, status: "VINCULO_ENCERRADO" });
    expect((await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } })).status).toBe("ACEITO");
    await expect(joinPersonalWithInvitation({ userId: user.id, code: token }, prisma)).rejects.toMatchObject({ kind: "JA_VINCULADO" });
  });

  it("recusa código expirado ou de convite já usado, e aluno ativo", async () => {
    const { user } = await exStudent("exp", "INATIVO");
    await invite("exp", `tok-${run}-exp`, { expiresAt: new Date(2020, 0, 1) });
    await expect(joinPersonalWithInvitation({ userId: user.id, code: `tok-${run}-exp` }, prisma)).rejects.toBeInstanceOf(StudentAccountError);
    await expect(joinPersonalWithInvitation({ userId: user.id, code: "nada" }, prisma)).rejects.toMatchObject({ kind: "CODIGO_INVALIDO" });

    const { user: active } = await exStudent("ativo", "ATIVO");
    await invite("ativo", `tok-${run}-ativo`);
    await expect(joinPersonalWithInvitation({ userId: active.id, code: `tok-${run}-ativo` }, prisma)).rejects.toMatchObject({ kind: "JA_VINCULADO" });
  });
});

describe("switchToIndividual (FIT-151)", () => {
  it("vira FitOS Livre e solta o vínculo antigo", async () => {
    const { user, student } = await exStudent("livre", "VINCULO_ENCERRADO");
    await switchToIndividual({ userId: user.id }, prisma);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("INDIVIDUAL");
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).userId).toBeNull();
    await expect(switchToIndividual({ userId: user.id }, prisma)).rejects.toMatchObject({ kind: "PAPEL_INVALIDO" });
  });
});

describe("invitationTokenFromCode", () => {
  it("lê token puro ou link", () => {
    expect(invitationTokenFromCode("  abc ")).toBe("abc");
    expect(invitationTokenFromCode("http://x/ativar-conta?token=a%2Bb&y=1")).toBe("a+b");
  });
});
