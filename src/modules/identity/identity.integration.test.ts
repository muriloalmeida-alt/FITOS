// @vitest-environment node
//
// Testes de integração da autenticação (FIT-009) contra um PostgreSQL real
// (banco de testes, migrations aplicadas via `prisma migrate deploy`).
// Constrói uma instância própria do Better Auth apontando para o banco de
// testes (a instância exportada em `auth.ts` usa o `PrismaClient`
// compartilhado, que aponta para o banco de desenvolvimento) — mesma
// configuração de `emailAndPassword`/`user.additionalFields`, apenas com o
// adapter Prisma trocado, para exercitar a integração real sem depender do
// banco de desenvolvimento.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import * as z from "zod";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const testAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // Mesma configuração de `auth.ts` (FIT-101/ADR-007): aceita
      // exatamente PERSONAL/INDIVIDUAL do cliente, rejeita qualquer outro
      // valor (em especial ALUNO) com 400 antes de tocar o banco.
      role: {
        type: "string",
        required: true,
        defaultValue: "PERSONAL",
        input: true,
        validator: { input: z.enum(["PERSONAL", "INDIVIDUAL"]) },
      },
    },
  },
  advanced: { database: { generateId: false } },
});

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const personalEmail = `personal-${run}@example.test`;
const password = "senha-valida-123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("cadastro de personal (FIT-009)", () => {
  it("cria uma conta válida com papel PERSONAL por padrão", async () => {
    const result = await testAuth.api.signUpEmail({
      body: { name: "Personal de teste", email: personalEmail, password },
    });

    expect(result.user.email).toBe(personalEmail);
    expect(result.user.role).toBe("PERSONAL");

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: personalEmail } });
    expect(stored.role).toBe("PERSONAL");
  });

  it("rejeita cadastro duplicado com o mesmo e-mail", async () => {
    await expect(
      testAuth.api.signUpEmail({
        body: { name: "Personal de teste (duplicado)", email: personalEmail, password },
      })
    ).rejects.toThrow();

    const count = await prisma.user.count({ where: { email: personalEmail } });
    expect(count).toBe(1);
  });

  it("rejeita tentativa do cliente de se autocadastrar como ALUNO (papel restrito a convite/ativação, FIT-015)", async () => {
    const email = `personal-role-adulterado-${run}@example.test`;

    await expect(
      testAuth.api.signUpEmail({
        body: { name: "Tentativa de role adulterado", email, password, role: "ALUNO" },
      })
    ).rejects.toThrow();

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(0);
  });

  it("rejeita qualquer valor de role fora de PERSONAL/INDIVIDUAL (ex.: string arbitrária)", async () => {
    const email = `personal-role-invalido-${run}@example.test`;

    await expect(
      testAuth.api.signUpEmail({
        body: { name: "Tentativa de role inválido", email, password, role: "ADMIN" },
      })
    ).rejects.toThrow();

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(0);
  });

  it("FIT-101: aceita role=INDIVIDUAL explicitamente no cadastro (escolha simétrica a PERSONAL)", async () => {
    const email = `individual-role-explicito-${run}@example.test`;

    const result = await testAuth.api.signUpEmail({
      body: { name: "Praticante sem personal", email, password, role: "INDIVIDUAL" },
    });

    expect(result.user.role).toBe("INDIVIDUAL");
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe("INDIVIDUAL");
  });

  it("nunca armazena a senha em texto puro", async () => {
    const account = await prisma.account.findFirstOrThrow({
      where: { user: { email: personalEmail }, providerId: "credential" },
    });

    expect(account.password).not.toBeNull();
    expect(account.password).not.toBe(password);
  });
});

describe("login (FIT-009)", () => {
  it("autentica com credenciais válidas", async () => {
    const result = await testAuth.api.signInEmail({ body: { email: personalEmail, password } });

    expect(result.user.email).toBe(personalEmail);
    expect(result.token).toBeTruthy();
  });

  it("rejeita senha incorreta", async () => {
    await expect(
      testAuth.api.signInEmail({ body: { email: personalEmail, password: "senha-errada-000" } })
    ).rejects.toThrow();
  });

  it("rejeita e-mail inexistente com o mesmo tipo de erro da senha incorreta (sem revelar existência de conta)", async () => {
    let errorForNonexistentEmail: unknown;
    let errorForWrongPassword: unknown;

    try {
      await testAuth.api.signInEmail({
        body: { email: `nao-existe-${run}@example.test`, password: "qualquer-coisa-123" },
      });
    } catch (error) {
      errorForNonexistentEmail = error;
    }

    try {
      await testAuth.api.signInEmail({ body: { email: personalEmail, password: "senha-errada-111" } });
    } catch (error) {
      errorForWrongPassword = error;
    }

    expect(errorForNonexistentEmail).toBeDefined();
    expect(errorForWrongPassword).toBeDefined();
    expect((errorForNonexistentEmail as { status?: unknown }).status).toBe(
      (errorForWrongPassword as { status?: unknown }).status
    );
  });
});

describe("sessão e logout (FIT-009)", () => {
  it("a sessão criada no login é válida e pode ser recuperada pelo token", async () => {
    const signIn = await testAuth.api.signInEmail({ body: { email: personalEmail, password } });
    const token = signIn.token;
    expect(token).toBeTruthy();

    const session = await prisma.session.findUniqueOrThrow({ where: { token: token! } });
    expect(session.userId).toBe(signIn.user.id);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("logout invalida a sessão (remove o registro de sessão)", async () => {
    // O token bruto (armazenado em `sessions.token`) é diferente do valor do
    // cookie, que o Better Auth assina. Para simular um logout real, é
    // preciso extrair o Set-Cookie devolvido pelo próprio login
    // (`returnHeaders: true`) em vez de fabricar o cookie manualmente.
    const signIn = await testAuth.api.signInEmail({
      body: { email: personalEmail, password },
      returnHeaders: true,
    });
    const token = signIn.response.token!;
    const cookiePairs = signIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
    expect(cookiePairs.length).toBeGreaterThan(0);

    await testAuth.api.signOut({ headers: new Headers({ cookie: cookiePairs.join("; ") }) });

    const session = await prisma.session.findUnique({ where: { token } });
    expect(session).toBeNull();
  });
});
