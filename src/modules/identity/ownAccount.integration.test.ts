// @vitest-environment node
//
// FIT-155 (EPIC-20): nome e e-mail da própria conta.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { changeOwnEmail, updateOwnName } from "./ownAccount";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.account.deleteMany({ where: { user: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("conta própria (FIT-155)", () => {
  it("troca nome e e-mail do aluno e do cadastro no personal; e-mail exige a senha", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Joana", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${run}` } });
    const user = await prisma.user.create({ data: { email: `pedro-${run}@example.test`, name: "Pedro", role: "ALUNO" } });
    await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword("senha-forte-123") } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `pedro-${run}@example.test`, displayName: "Pedro", userId: user.id } });
    await prisma.student.create({ data: { tenantId: tenant.id, email: `ocupado-${run}@example.test`, displayName: "Outro" } });
    await prisma.user.create({ data: { email: `usado-${run}@example.test`, name: "Usado", role: "PERSONAL" } });

    await updateOwnName({ userId: user.id, name: "  Pedro Lima " }, prisma);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).displayName).toBe("Pedro Lima");

    await expect(changeOwnEmail({ userId: user.id, email: `novo-${run}@example.test`, password: "errada" }, prisma)).rejects.toMatchObject({ kind: "SENHA_INCORRETA" });
    await expect(changeOwnEmail({ userId: user.id, email: `usado-${run}@example.test`, password: "senha-forte-123" }, prisma)).rejects.toMatchObject({ kind: "EMAIL_EM_USO" });
    await expect(changeOwnEmail({ userId: user.id, email: `ocupado-${run}@example.test`, password: "senha-forte-123" }, prisma)).rejects.toMatchObject({ kind: "EMAIL_EM_USO" });
    await expect(changeOwnEmail({ userId: user.id, email: "nao-e-email", password: "senha-forte-123" }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });

    await changeOwnEmail({ userId: user.id, email: ` NOVO-${run}@Example.test `, password: "senha-forte-123" }, prisma);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(`novo-${run}@example.test`);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).email).toBe(`novo-${run}@example.test`);
  });
});
