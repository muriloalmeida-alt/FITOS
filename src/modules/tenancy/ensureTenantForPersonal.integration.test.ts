// @vitest-environment node
//
// Testes de integração do provisionamento de tenant (FIT-010) contra um
// PostgreSQL real (banco de testes). Usa uma instância própria do Prisma
// apontando para `fitos_test`, no mesmo padrão dos demais testes de
// integração deste projeto (isolation.integration.test.ts,
// identity.integration.test.ts).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureTenantForPersonal } from "./ensureTenantForPersonal";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createRawUser(role: "PERSONAL" | "ALUNO", label: string) {
  return prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste ${run}`, role },
  });
}

describe("ensureTenantForPersonal (FIT-010)", () => {
  it("provisionamento normal: cria exatamente um tenant para um personal sem tenant", async () => {
    const user = await createRawUser("PERSONAL", "normal");

    const tenant = await ensureTenantForPersonal(user, prisma);

    expect(tenant.ownerId).toBe(user.id);
    expect(tenant.name).toBe(`Espaço de ${user.name.split(" ")[0]}`);

    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it("idempotência: chamar novamente para o mesmo personal retorna o mesmo tenant, sem duplicar", async () => {
    const user = await createRawUser("PERSONAL", "idempotente");

    const first = await ensureTenantForPersonal(user, prisma);
    const second = await ensureTenantForPersonal(user, prisma);

    expect(second.id).toBe(first.id);
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it("concorrência: chamadas simultâneas para o mesmo personal resultam em um único tenant", async () => {
    const user = await createRawUser("PERSONAL", "concorrente");

    const [a, b, c] = await Promise.all([
      ensureTenantForPersonal(user, prisma),
      ensureTenantForPersonal(user, prisma),
      ensureTenantForPersonal(user, prisma),
    ]);

    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });

  it("rejeita provisionar tenant para um usuário com papel ALUNO", async () => {
    const user = await createRawUser("ALUNO", "aluno-tentativa");

    await expect(ensureTenantForPersonal(user, prisma)).rejects.toThrow();

    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(0);
  });

  it("personal existente sem tenant é reparado (mesmo cenário de um provisionamento automático que falhou antes)", async () => {
    // Simula exatamente a lacuna que o hook de cadastro poderia deixar: um
    // User PERSONAL já existe (como se o hook após o cadastro tivesse
    // falhado), sem nenhum Tenant. `ensureTenantForPersonal` é a mesma
    // função usada para reparar esse estado, chamada por
    // `provisionTenantForCurrentSession` a partir de qualquer página
    // autenticada.
    const user = await createRawUser("PERSONAL", "sem-tenant-previo");
    const beforeCount = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(beforeCount).toBe(0);

    const tenant = await ensureTenantForPersonal(user, prisma);

    expect(tenant.ownerId).toBe(user.id);
  });

  it("personal com tenant já existente: retorna o tenant existente sem criar um segundo", async () => {
    const user = await createRawUser("PERSONAL", "com-tenant-previo");
    const preexisting = await prisma.tenant.create({
      data: { ownerId: user.id, name: "Nome definido manualmente antes" },
    });

    const tenant = await ensureTenantForPersonal(user, prisma);

    expect(tenant.id).toBe(preexisting.id);
    expect(tenant.name).toBe("Nome definido manualmente antes");
    const count = await prisma.tenant.count({ where: { ownerId: user.id } });
    expect(count).toBe(1);
  });
});

describe("provisionamento automático no cadastro real (FIT-009 + FIT-010 integrados)", () => {
  const testAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    user: {
      additionalFields: {
        role: { type: "string", required: true, defaultValue: "PERSONAL", input: false },
      },
    },
    advanced: { database: { generateId: false } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.role !== "PERSONAL") {
              return;
            }
            await ensureTenantForPersonal({ id: user.id, name: user.name, role: user.role }, prisma);
          },
        },
      },
    },
  });

  it("um novo cadastro de personal já recebe um tenant, sem nenhuma chamada adicional", async () => {
    const email = `cadastro-real-${run}@example.test`;

    const result = await testAuth.api.signUpEmail({
      body: { name: "Personal com tenant automático", email, password: "senha-valida-123" },
    });

    const tenant = await prisma.tenant.findUnique({ where: { ownerId: result.user.id } });
    expect(tenant).not.toBeNull();
    expect(tenant?.name).toBe("Espaço de Personal");
  });
});
