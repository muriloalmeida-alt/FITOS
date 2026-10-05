// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureAdminAccount } from "./bootstrap";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("ensureAdminAccount (admin:garantir)", () => {
  it("cria uma vez, nunca troca a senha depois e nunca promove outra conta", async () => {
    const email = `Admin-${run}@Example.test`;
    expect(await ensureAdminAccount({}, prisma)).toBe("SEM_CONFIGURACAO");
    expect(await ensureAdminAccount({ email, password: "senha-forte-123" }, prisma)).toBe("CRIADO");
    expect(await ensureAdminAccount({ email, password: "outra-senha-456" }, prisma)).toBe("JA_EXISTE");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() }, include: { accounts: true } });
    expect(user.role).toBe("ADMIN");
    expect(user.accounts[0]).toMatchObject({ providerId: "credential", accountId: user.id });
    expect(await verifyPassword({ hash: user.accounts[0]!.password!, password: "senha-forte-123" })).toBe(true);

    const personal = await prisma.user.create({ data: { email: `personal-${run}@example.test`, name: "Joana", role: "PERSONAL" } });
    expect(await ensureAdminAccount({ email: personal.email, password: "senha-forte-123" }, prisma)).toBe("CONFLITO");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: personal.id } })).role).toBe("PERSONAL");
    await expect(ensureAdminAccount({ email: `x-${run}@example.test`, password: "curta" }, prisma)).rejects.toThrow();
  });
});
