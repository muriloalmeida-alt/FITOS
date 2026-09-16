// @vitest-environment node
//
// Testes de integração da ativação de conta do aluno (FIT-015) contra
// PostgreSQL real (banco de testes). `testAuth` é uma instância própria do
// Better Auth apontando para o banco de testes, sem o databaseHooks de
// provisionamento automático de tenant de `auth.ts` (aquele hook, em
// produção, usa o PrismaClient compartilhado ligado ao banco de
// desenvolvimento — replicá-lo diretamente aqui causaria uma violação de FK
// entre bancos diferentes). `testAuthWithHook`, abaixo, reproduz o mesmo
// hook chamando `ensureTenantForPersonal` (que aceita um `client` injetado)
// com o `prisma` de testes — reproduzindo o percurso real de produção (o
// tenant automático da FIT-010 sendo criado e depois desfeito) sem essa
// violação de FK. `testAuth` continua a instância padrão para os testes que
// não precisam desse percurso.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { activateStudentAccount, ActivationError, checkActivationToken } from "./activation";
import { generateInvitation, hashInvitationToken } from "@/modules/students/invitations";
import { ensureTenantForPersonal } from "@/modules/tenancy/ensureTenantForPersonal";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

// Caixa mutável simples para capturar o id do `User` criado por
// `signUpEmail` durante um teste — via `databaseHooks.user.create.after`,
// que roda de forma síncrona como parte do próprio fluxo de `signUpEmail`,
// antes de `activateStudentAccount` ter qualquer chance de fazer a limpeza.
// Evita ter que embrulhar `authInstance.api.signUpEmail` num objeto próprio
// (que não teria as propriedades internas do endpoint real do Better Auth
// exigidas pelo tipo `SignUpEmailCompatibleAuth` de `activation.ts`) — os
// testes continuam passando a instância real (`testAuth`/`testAuthWithHook`).
const lastSignUpUserId: { current?: string } = {};

const testAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  user: { additionalFields: { role: { type: "string", required: true, defaultValue: "PERSONAL", input: false } } },
  advanced: { database: { generateId: false } },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          lastSignUpUserId.current = user.id;
        },
      },
    },
  },
});

const testAuthWithHook = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  user: { additionalFields: { role: { type: "string", required: true, defaultValue: "PERSONAL", input: false } } },
  advanced: { database: { generateId: false } },
  databaseHooks: {
    user: {
      create: {
        // Mesma lógica de `auth.ts` (FIT-010), com o `prisma` de testes
        // injetado em vez do singleton de desenvolvimento.
        after: async (user) => {
          lastSignUpUserId.current = user.id;
          if (user.role !== "PERSONAL") {
            return;
          }
          await ensureTenantForPersonal({ id: user.id, name: user.name, role: user.role }, prisma);
        },
      },
    },
  },
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

  it("falha na etapa de vínculo após a conta já criada: User é desfeito, convite volta a PENDENTE, e uma nova tentativa válida funciona", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-falha-pos-signup");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    // Client que deixa `signUpEmail` criar a conta normalmente (ele usa a
    // instância `testAuth`, ligada ao `prisma` real), mas força a transação
    // de vínculo (tenant/role/Student) a falhar depois — simulando qualquer
    // erro depois que a conta já existe (ex.: falha de conexão).
    const failingClient = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop === "$transaction") {
          return async () => {
            throw new Error("falha simulada na etapa de vínculo");
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    await expect(
      activateStudentAccount(
        { token: rawToken, password },
        { authInstance: testAuth, client: failingClient as unknown as PrismaClient }
      )
    ).rejects.toThrow("falha simulada na etapa de vínculo");

    // O User criado por `signUpEmail` não pode sobreviver à falha: senão o
    // e-mail fica "ocupado" por uma conta sem Student vinculado, para sempre.
    const orphanUser = await prisma.user.findUnique({ where: { email: student.email } });
    expect(orphanUser).toBeNull();

    const invitationAfterFailure = await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } });
    expect(invitationAfterFailure.status).toBe("PENDENTE");
    expect(invitationAfterFailure.acceptedAt).toBeNull();

    const studentAfterFailure = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(studentAfterFailure.userId).toBeNull();

    // Uma nova tentativa (mesmo token, banco/auth reais de novo) precisa
    // funcionar — não pode ficar travada em EMAIL_EM_USO por uma conta
    // órfã que devia ter sido removida.
    const retry = await activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma });
    expect(retry.studentId).toBe(student.id);

    const linkedUser = await prisma.user.findUniqueOrThrow({ where: { email: student.email } });
    expect(linkedUser.role).toBe("ALUNO");
  });

  it("percurso real de produção (com o hook de provisionamento automático de tenant da FIT-010): falha na etapa de vínculo remove tenant automático E User, convite volta a PENDENTE, nova tentativa funciona", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-falha-com-hook");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    // Captura o id do User criado por `signUpEmail` (via
    // `lastSignUpUserId`, preenchido pelo `databaseHooks` de
    // `testAuthWithHook`, que reproduz o hook real da FIT-010 contra o
    // banco de testes) para poder consultar diretamente o tenant
    // automático que o hook provisiona — o nome gerado (`tenantNameFor`)
    // não contém `run`, então não seria encontrável pelo filtro de
    // limpeza do `afterAll`.
    lastSignUpUserId.current = undefined;

    const failingTransactionClient = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop === "$transaction") {
          return async () => {
            throw new Error("falha simulada na etapa de vínculo (percurso com hook)");
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    await expect(
      activateStudentAccount(
        { token: rawToken, password },
        { authInstance: testAuthWithHook, client: failingTransactionClient as unknown as PrismaClient }
      )
    ).rejects.toThrow("falha simulada na etapa de vínculo (percurso com hook)");
    const capturedUserId = lastSignUpUserId.current;
    expect(capturedUserId).toBeDefined();

    // O hook real provisionou um tenant automático para esse User (criado
    // como PERSONAL, antes da correção de papel) — a limpeza precisa
    // remover esse tenant, não só o User.
    const orphanTenant = await prisma.tenant.findUnique({ where: { ownerId: capturedUserId! } });
    expect(orphanTenant).toBeNull();
    const orphanUser = await prisma.user.findUnique({ where: { id: capturedUserId! } });
    expect(orphanUser).toBeNull();

    const invitationAfterFailure = await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } });
    expect(invitationAfterFailure.status).toBe("PENDENTE");

    const retry = await activateStudentAccount(
      { token: rawToken, password },
      { authInstance: testAuthWithHook, client: prisma }
    );
    expect(retry.studentId).toBe(student.id);

    const linkedUser = await prisma.user.findUniqueOrThrow({ where: { email: student.email } });
    expect(linkedUser.role).toBe("ALUNO");
    // O tenant automático desta segunda tentativa (bem-sucedida) também
    // precisa ter sido desfeito pela transação de vínculo real.
    const secondAttemptTenant = await prisma.tenant.findUnique({ where: { ownerId: linkedUser.id } });
    expect(secondAttemptTenant).toBeNull();
  });

  it("falha ao desfazer a conta órfã (a própria limpeza falha): convite permanece ACEITO (nunca reaberto sem confirmar a remoção), erro original relançado, e uma nova tentativa com o mesmo token é rejeitada de forma consistente", async () => {
    const { tenant, student, owner } = await createTenantWithStudent("ativar-falha-na-limpeza");
    const { rawToken } = await generateInvitation({ tenantId: tenant.id, studentId: student.id, actorUserId: owner.id }, prisma);

    lastSignUpUserId.current = undefined;

    // `tenant.deleteMany` lança de forma síncrona sempre que chamado — isso
    // já derruba a própria construção do array passado a `$transaction`
    // (o primeiro elemento é justamente `client.tenant.deleteMany(...)`),
    // então nunca chega a `client.$transaction` nem a `user.update`/
    // `student.updateMany`. É a mesma chamada usada depois, na limpeza —
    // por isso ela também falha ali, simulando uma limpeza que não
    // consegue remover a conta órfã.
    const brokenCleanupClient = new Proxy(prisma, {
      get(target, prop) {
        if (prop === "tenant") {
          // Objeto independente, sem prototype ligado ao delegate real do
          // Prisma — `client.tenant.deleteMany` é o único método de
          // `tenant` que `activateStudentAccount` chama, então não há
          // necessidade de herdar nada do delegate original (evita
          // qualquer efeito colateral de tentar copiar/agarrar um
          // getter/cache interno do Prisma).
          return {
            deleteMany: () => {
              throw new Error("falha simulada ao remover o tenant órfão");
            },
          };
        }
        return Reflect.get(target, prop);
      },
    });

    await expect(
      activateStudentAccount(
        { token: rawToken, password },
        { authInstance: testAuth, client: brokenCleanupClient as unknown as PrismaClient }
      )
    ).rejects.toThrow("falha simulada ao remover o tenant órfão");
    const capturedUserId = lastSignUpUserId.current;
    expect(capturedUserId).toBeDefined();

    // A limpeza falhou de propósito: o User órfão precisa continuar
    // existindo — é exatamente esse estado que exige não reabrir o convite.
    const orphanUser = await prisma.user.findUnique({ where: { id: capturedUserId! } });
    expect(orphanUser).not.toBeNull();

    // O convite NÃO pode voltar a PENDENTE aqui — isso enganaria a próxima
    // tentativa (ela acharia que pode tentar de novo, e bateria em
    // EMAIL_EM_USO sem nenhuma pista do que aconteceu). Continua ACEITO.
    const invitationAfterFailure = await prisma.invitation.findFirstOrThrow({ where: { studentId: student.id } });
    expect(invitationAfterFailure.status).toBe("ACEITO");

    // Uma nova tentativa com o mesmo token é rejeitada de forma consistente
    // (o convite não está PENDENTE) — nunca uma falsa promessa de que
    // tentar de novo vai funcionar.
    await expect(
      activateStudentAccount({ token: rawToken, password }, { authInstance: testAuth, client: prisma })
    ).rejects.toMatchObject({ kind: "TOKEN_INVALIDO" });

    // Limpeza do próprio teste: remove a conta órfã diretamente (fora do
    // fluxo em teste, que foi deliberadamente impedido de fazer isso).
    await prisma.user.delete({ where: { id: capturedUserId! } });
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
