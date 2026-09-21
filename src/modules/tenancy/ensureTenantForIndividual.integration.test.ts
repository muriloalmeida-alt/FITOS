// @vitest-environment node
//
// Testes de integração do provisionamento de workspace individual
// (FIT-100, EPIC-13) contra um PostgreSQL real (banco de testes). Mesmo
// padrão de `ensureTenantForPersonal.integration.test.ts`.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureTenantForIndividual } from "./ensureTenantForIndividual";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createRawUser(role: "PERSONAL" | "ALUNO" | "INDIVIDUAL", label: string) {
  return prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste ${run}`, role },
  });
}

describe("ensureTenantForIndividual (FIT-100)", () => {
  it("provisionamento normal: cria exatamente um tenant do tipo INDIVIDUAL", async () => {
    const user = await createRawUser("INDIVIDUAL", "normal");

    const tenant = await ensureTenantForIndividual(user, prisma);

    expect(tenant.ownerId).toBe(user.id);
    expect(tenant.type).toBe("INDIVIDUAL");
    expect(tenant.name).toBe(`Espaço de ${user.name.split(" ")[0]}`);

    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it("idempotência: chamar novamente para o mesmo usuário retorna o mesmo tenant, sem duplicar", async () => {
    const user = await createRawUser("INDIVIDUAL", "idempotente");

    const first = await ensureTenantForIndividual(user, prisma);
    const second = await ensureTenantForIndividual(user, prisma);

    expect(second.id).toBe(first.id);
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it("concorrência: chamadas simultâneas para o mesmo usuário resultam em um único tenant", async () => {
    const user = await createRawUser("INDIVIDUAL", "concorrente");

    const [a, b, c] = await Promise.all([
      ensureTenantForIndividual(user, prisma),
      ensureTenantForIndividual(user, prisma),
      ensureTenantForIndividual(user, prisma),
    ]);

    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it.each(["PERSONAL", "ALUNO"] as const)("rejeita provisionar workspace individual para um usuário com papel %s", async (role) => {
    const user = await createRawUser(role, `papel-errado-${role.toLowerCase()}`);

    await expect(ensureTenantForIndividual(user, prisma)).rejects.toThrow();

    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(0);
  });

  it("usuário INDIVIDUAL com tenant já existente: retorna o tenant existente sem criar um segundo", async () => {
    const user = await createRawUser("INDIVIDUAL", "com-tenant-previo");
    const preexisting = await prisma.tenant.create({
      data: { ownerId: user.id, name: "Nome definido manualmente antes", type: "INDIVIDUAL" },
    });

    const tenant = await ensureTenantForIndividual(user, prisma);

    expect(tenant.id).toBe(preexisting.id);
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });
});

describe("provisionamento automático no cadastro real (mesma lógica de auth.ts)", () => {
  const testAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    user: {
      additionalFields: {
        // `input: true` só neste harness de teste, para simular o futuro
        // fluxo de cadastro da FIT-101 — o `auth.ts` real mantém
        // `input: false` (nenhuma rota pública produz INDIVIDUAL ainda).
        role: { type: "string", required: true, defaultValue: "PERSONAL", input: true },
      },
    },
    advanced: { database: { generateId: false } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.role !== "INDIVIDUAL") {
              return;
            }
            await ensureTenantForIndividual({ id: user.id, name: user.name, role: user.role }, prisma);
          },
        },
      },
    },
  });

  it("um novo cadastro INDIVIDUAL já recebe um workspace do tipo INDIVIDUAL, sem nenhuma chamada adicional", async () => {
    const email = `cadastro-real-individual-${run}@example.test`;

    const result = await testAuth.api.signUpEmail({
      body: { name: "Praticante com workspace automático", email, password: "senha-valida-123", role: "INDIVIDUAL" },
    });

    const tenant = await prisma.tenant.findUnique({ where: { ownerId: result.user.id } });
    expect(tenant).not.toBeNull();
    expect(tenant?.type).toBe("INDIVIDUAL");
    expect(tenant?.name).toBe("Espaço de Praticante");
  });
});
