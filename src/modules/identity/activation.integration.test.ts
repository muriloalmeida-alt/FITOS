// @vitest-environment node
//
// Testes de integração da ativação de conta do aluno (FIT-015) contra
// PostgreSQL real (banco de testes). Constrói uma instância própria do
// Better Auth apontando para o banco de testes, sem o databaseHooks de
// provisionamento automático de tenant (esse hook, em auth.ts, usa o
// PrismaClient compartilhado ligado ao banco de desenvolvimento — replicá-lo
// aqui causaria uma violação de FK entre bancos diferentes). Por isso estes
// testes não exercitam a etapa "desfazer o tenant automático" — essa
// interação específica é comprovada via evidência real (servidor de
// produção, auth real) em docs/06-engenharia/evidencias/FIT-015/.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { activateStudentAccount, ActivationError, checkActivationToken } from "./activation";
import { generateInvitation, hashInvitationToken } from "@/modules/students/invitations";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const testAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  user: { additionalFields: { role: { type: "string", required: true, defaultValue: "PERSONAL", input: false } } },
  advanced: { database: { generateId: false } },
});

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "senha-valida-123";

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

describe("checkActivationToken (FIT-015)", () => {
  it("token válido: retorna valid=true com o nome do aluno", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("check-valido");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const result = await checkActivationToken(rawToken, prisma);

    expect(result).toEqual({ valid: true, studentName: student.displayName });
  });

  it("token inexistente: valid=false, sem nenhum dado do aluno", async () => {
    const result = await checkActivationToken("token-que-nunca-existiu", prisma);
    expect(result).toEqual({ valid: false });
  });

  it("token expirado: valid=false", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("check-expirado");
    const { rawToken, invitation } = await generateInvitation(
      { tenantId: tenant.id, studentId: student.id, actorUserId: owner.id },
      prisma
    );
    await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await checkActivationToken(rawToken, prisma);
    expect(result).toEqual({ valid: false });
  });

  it("token cancelado: valid=false", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("check-cancelado");
    const { rawToken, invitation } = await generateInvitation(
      { tenantId: tenant.id, studentId: student.id, actorUserId: owner.id },
      prisma
    );
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "CANCELADO" } });

    const result = await checkActivationToken(rawToken, prisma);
    expect(result).toEqual({ valid: false });
  });
});

describe("activateStudentAccount (FIT-015)", () => {
  it("ativa a conta com um token válido: cria User ALUNO, vincula ao Student, marca convite ACEITO", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-feliz");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const result = await activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma });

    expect(result.studentId).toBe(student.id);
    expect(result.tenantId).toBe(tenant.id);
    expect(result.headers.getSetCookie().length).toBeGreaterThan(0);

    const updatedStudent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(updatedStudent.userId).not.toBeNull();

    const linkedUser = await prisma.user.findUniqueOrThrow({ where: { id: updatedStudent.userId! } });
    expect(linkedUser.role).toBe("ALUNO");
    expect(linkedUser.email).toBe(student.email);

    const invitation = await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } });
    expect(invitation.status).toBe("ACEITO");
    expect(invitation.acceptedAt).not.toBeNull();
  });

  it("aluno consegue autenticar normalmente depois da ativação", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-login-depois");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    await activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma });

    const login = await testAuth.api.signInEmail({ body: { email: student.email, password } });

    expect(login.user.email).toBe(student.email);
  });

  it("token inexistente: TOKEN_INVALIDO", async () => {
    await expect(
      activateStudentAccount({ token: "token-fabricado", password }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "TOKEN_INVALIDO" });
  });

  it("token expirado: TOKEN_INVALIDO", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-expirado");
    const { rawToken, invitation } = await generateInvitation(
      { tenantId: tenant.id, studentId: student.id, actorUserId: owner.id },
      prisma
    );
    await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "TOKEN_INVALIDO" });
  });

  it("token cancelado: TOKEN_INVALIDO", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-cancelado");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    await prisma.invitation.updateMany({ where: { studentId: student.id }, data: { status: "CANCELADO" } });

    await expect(
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "TOKEN_INVALIDO" });
  });

  it("replay: usar o mesmo token de novo depois de já ter ativado -> TOKEN_INVALIDO", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-replay");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    await activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma });

    await expect(
      activateStudentAccount({ token: rawToken, password: "outra-senha-valida" }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "TOKEN_INVALIDO" });
  });

  it("ativação concorrente com o mesmo token: exatamente uma sucede, a outra é rejeitada, sem duplicar User", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-concorrente");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    const results = await Promise.allSettled([
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma }),
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ kind: "TOKEN_INVALIDO" });

    const usersWithEmail = await prisma.user.findMany({ where: { email: student.email } });
    expect(usersWithEmail).toHaveLength(1);
  });

  it("e-mail já em uso por outra conta criada no intervalo: EMAIL_EM_USO, convite volta a PENDENTE", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-email-em-uso");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);
    // Simula uma conta criada no meio do caminho com o mesmo e-mail do aluno.
    await prisma.user.create({ data: { email: student.email, name: "Conta concorrente", role: "PERSONAL" } });

    await expect(
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "EMAIL_EM_USO" });

    const invitation = await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } });
    expect(invitation.status).toBe("PENDENTE");
  });

  it("token não aparece em nenhum campo do banco — apenas o hash", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-hash");
    const { rawToken, invitation } = await generateInvitation(
      { tenantId: tenant.id, studentId: student.id, actorUserId: owner.id },
      prisma
    );

    expect(invitation.tokenHash).toBe(hashInvitationToken(rawToken));
    expect(invitation.tokenHash).not.toBe(rawToken);
    const raw = await prisma.$queryRawUnsafe<{ tokenHash: string }[]>(
      `SELECT "tokenHash" FROM invitations WHERE id = $1`,
      invitation.id
    );
    expect(raw[0]?.tokenHash).not.toContain(rawToken);
  });
});
