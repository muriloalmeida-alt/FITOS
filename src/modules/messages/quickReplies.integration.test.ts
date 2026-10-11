// @vitest-environment node
//
// Respostas rápidas do personal (EPIC-41) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { DEFAULT_QUICK_REPLIES, getQuickReplies, setQuickReplies } from "./quickReplies";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("respostas rápidas (EPIC-41)", () => {
  it("padrão até salvar; salva limpa, sem repetidas; lista vazia vale", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    expect(await getQuickReplies(tenant.id, prisma)).toEqual(DEFAULT_QUICK_REPLIES);
    expect(await setQuickReplies(tenant.id, ["  Boa!  ", "", "Boa!", "Suba 2 kg"], prisma)).toEqual(["Boa!", "Suba 2 kg"]);
    expect(await getQuickReplies(tenant.id, prisma)).toEqual(["Boa!", "Suba 2 kg"]);
    expect(await setQuickReplies(tenant.id, [], prisma)).toEqual([]);
    expect(await getQuickReplies(tenant.id, prisma)).toEqual([]);
    await expect(setQuickReplies(tenant.id, Array.from({ length: 21 }, (_, i) => `r${i}`), prisma)).rejects.toThrow("Até 20");
    await expect(setQuickReplies(tenant.id, ["x".repeat(301)], prisma)).rejects.toThrow("até 300 caracteres");
    await expect(setQuickReplies(tenant.id, "não é lista", prisma)).rejects.toThrow("Lista inválida.");
  });
});
