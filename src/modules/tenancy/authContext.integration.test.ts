// @vitest-environment node
//
// Testes de integração da camada de autorização (FIT-011) contra um
// PostgreSQL real (banco de testes). `getServerSession()` depende de
// `next/headers()`, que só funciona dentro do runtime de requisição do
// Next.js — por isso os testes chamam `getAuthContext`/`requireSession`/
// `requirePersonal`/`requireStudent` com o parâmetro de sessão simulada
// (`sessionOverride`), exatamente como a própria implementação documenta.
// Tudo o mais (Tenant, Student, constraints físicas) é real, contra
// `fitos_test`.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  AuthError,
  assertTenantAccess,
  getAuthContext,
  requireIndividual,
  requirePersonal,
  requireSession,
  requireStudent,
} from "./authContext";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.student.deleteMany({ where: { user: { email: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createPersonalWithTenant(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Tenant ${label}` } });
  return { user, tenant };
}

async function createIndividualUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "INDIVIDUAL" },
  });
}

async function createStudentFor(tenantId: string, label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "ALUNO" },
  });
  const student = await prisma.student.create({
    data: { tenantId, userId: user.id, email: user.email, displayName: `${label} de teste` },
  });
  return { user, student };
}

function sessionFor(user: { id: string; name: string; role: string }) {
  return { user } as unknown as Parameters<typeof getAuthContext>[0];
}

describe("getAuthContext (FIT-011)", () => {
  it("personal no próprio tenant: retorna role PERSONAL e o tenantId correto", async () => {
    const { user, tenant } = await createPersonalWithTenant("personal-normal");

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx).toEqual({
      authenticated: true,
      userId: user.id,
      role: "PERSONAL",
      tenantId: tenant.id,
      studentId: null,
    });
  });

  it("aluno no próprio perfil: retorna role ALUNO com tenantId e studentId corretos", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-do-aluno");
    const { user, student } = await createStudentFor(tenant.id, "aluno-normal");
    void owner;

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx).toEqual({
      authenticated: true,
      userId: user.id,
      role: "ALUNO",
      tenantId: tenant.id,
      studentId: student.id,
    });
  });

  it("sessão válida para usuário ALUNO sem vínculo (Student inexistente) -> tenantId/studentId nulos, não erro", async () => {
    const user = await prisma.user.create({
      data: { email: `aluno-sem-vinculo-${run}@example.test`, name: "Aluno sem vínculo", role: "ALUNO" },
    });

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx).toEqual({ authenticated: true, userId: user.id, role: "ALUNO", tenantId: null, studentId: null });
  });

  it("usuário sem sessão (ou sessão inválida): authenticated false", async () => {
    const ctx = await getAuthContext(null, prisma);
    expect(ctx).toEqual({ authenticated: false });
  });

  it("FIT-100: individual sem tenant prévio -> autocura provisiona o workspace e retorna role INDIVIDUAL", async () => {
    const user = await createIndividualUser("individual-autocura");

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx.authenticated).toBe(true);
    if (!ctx.authenticated) throw new Error("unreachable");
    expect(ctx.role).toBe("INDIVIDUAL");
    expect(ctx.studentId).toBeNull();
    expect(ctx.tenantId).not.toBeNull();

    const tenant = await prisma.tenant.findUnique({ where: { ownerId: user.id } });
    expect(tenant?.type).toBe("INDIVIDUAL");
    expect(ctx.tenantId).toBe(tenant?.id);
  });

  it("FIT-014: aluno inativado pelo personal -> tratado como sem vínculo (tenantId/studentId nulos), não erro", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-aluno-inativado");
    const { user } = await createStudentFor(tenant.id, "aluno-inativado");
    void owner;
    await prisma.student.update({ where: { userId: user.id }, data: { status: "INATIVO" } });

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx).toEqual({ authenticated: true, userId: user.id, role: "ALUNO", tenantId: null, studentId: null });
  });

  it("FIT-106: aluno com vínculo encerrado -> tratado como sem vínculo (tenantId/studentId nulos), não erro", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-aluno-encerrado");
    const { user } = await createStudentFor(tenant.id, "aluno-encerrado");
    void owner;
    await prisma.student.update({ where: { userId: user.id }, data: { status: "VINCULO_ENCERRADO" } });

    const ctx = await getAuthContext(sessionFor(user), prisma);

    expect(ctx).toEqual({ authenticated: true, userId: user.id, role: "ALUNO", tenantId: null, studentId: null });
  });
});

describe("requireSession / requirePersonal / requireStudent (FIT-011)", () => {
  it("usuário sem sessão -> requireSession lança AuthError UNAUTHENTICATED", async () => {
    await expect(requireSession(null, prisma)).rejects.toMatchObject({ kind: "UNAUTHENTICATED" });
  });

  it("aluno tentando rota exclusiva do personal -> requirePersonal lança AuthError FORBIDDEN", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-forbidden-1");
    const { user } = await createStudentFor(tenant.id, "aluno-tentando-personal");
    void owner;

    await expect(requirePersonal(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("personal tentando rota exclusiva do aluno -> requireStudent lança AuthError FORBIDDEN", async () => {
    const { user } = await createPersonalWithTenant("personal-tentando-aluno");

    await expect(requireStudent(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("aluno sem vínculo (Student inexistente) tentando requireStudent -> FORBIDDEN, não erro interno", async () => {
    const user = await prisma.user.create({
      data: { email: `aluno-sem-vinculo-forbidden-${run}@example.test`, name: "Aluno sem vínculo", role: "ALUNO" },
    });

    await expect(requireStudent(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-014: aluno inativado tentando requireStudent -> FORBIDDEN, não acessa a experiência normal", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-aluno-inativado-forbidden");
    const { user } = await createStudentFor(tenant.id, "aluno-inativado-forbidden");
    void owner;
    await prisma.student.update({ where: { userId: user.id }, data: { status: "INATIVO" } });

    await expect(requireStudent(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-106: aluno com vínculo encerrado tentando requireStudent -> FORBIDDEN, não acessa a experiência normal", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-aluno-encerrado-forbidden");
    const { user } = await createStudentFor(tenant.id, "aluno-encerrado-forbidden");
    void owner;
    await prisma.student.update({ where: { userId: user.id }, data: { status: "VINCULO_ENCERRADO" } });

    await expect(requireStudent(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-100: individual tentando rota exclusiva do personal -> requirePersonal lança AuthError FORBIDDEN", async () => {
    const user = await createIndividualUser("individual-tentando-personal");

    await expect(requirePersonal(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-100: individual tentando rota exclusiva do aluno -> requireStudent lança AuthError FORBIDDEN", async () => {
    const user = await createIndividualUser("individual-tentando-aluno");

    await expect(requireStudent(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-100: personal tentando rota exclusiva do individual -> requireIndividual lança AuthError FORBIDDEN", async () => {
    const { user } = await createPersonalWithTenant("personal-tentando-individual");

    await expect(requireIndividual(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-100: aluno tentando rota exclusiva do individual -> requireIndividual lança AuthError FORBIDDEN", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-aluno-tentando-individual");
    const { user } = await createStudentFor(tenant.id, "aluno-tentando-individual");
    void owner;

    await expect(requireIndividual(sessionFor(user), prisma)).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("FIT-100: individual autenticado acessa requireIndividual normalmente, com workspace autoprovisionado", async () => {
    const user = await createIndividualUser("individual-acesso-normal");

    const ctx = await requireIndividual(sessionFor(user), prisma);

    expect(ctx.userId).toBe(user.id);
    expect(ctx.role).toBe("INDIVIDUAL");
    const tenant = await prisma.tenant.findUnique({ where: { ownerId: user.id } });
    expect(ctx.tenantId).toBe(tenant?.id);
  });

  it("personal autenticado acessa requirePersonal normalmente", async () => {
    const { user, tenant } = await createPersonalWithTenant("personal-acesso-normal");

    const ctx = await requirePersonal(sessionFor(user), prisma);

    expect(ctx).toEqual({ userId: user.id, role: "PERSONAL", tenantId: tenant.id });
  });

  it("aluno autenticado acessa requireStudent normalmente", async () => {
    const { user: owner, tenant } = await createPersonalWithTenant("dono-para-acesso-normal");
    const { user, student } = await createStudentFor(tenant.id, "aluno-acesso-normal");
    void owner;

    const ctx = await requireStudent(sessionFor(user), prisma);

    expect(ctx).toEqual({ userId: user.id, role: "ALUNO", tenantId: tenant.id, studentId: student.id });
  });
});

describe("assertTenantAccess e isolamento entre tenants (FIT-011)", () => {
  it("personal tentando outro tenant: assertTenantAccess rejeita", async () => {
    const { tenant: tenantA } = await createPersonalWithTenant("tenant-a-assert");
    const { tenant: tenantB } = await createPersonalWithTenant("tenant-b-assert");

    expect(() => assertTenantAccess(tenantA.id, tenantB.id)).toThrow(AuthError);
    expect(() => assertTenantAccess(tenantA.id, tenantA.id)).not.toThrow();
  });

  it("payload com tenantId adulterado nunca substitui o tenant real da sessão", async () => {
    const { user, tenant: tenantReal } = await createPersonalWithTenant("tenant-real-adulterado");
    const { tenant: tenantAdulterado } = await createPersonalWithTenant("tenant-adulterado");

    // Simula um cliente enviando um tenantId diferente por qualquer via
    // (query string, header, corpo) — a função não tem nenhum parâmetro
    // que aceite isso; o único tenantId possível é o derivado da sessão.
    const ctx = await requirePersonal(sessionFor(user), prisma);

    expect(ctx.tenantId).toBe(tenantReal.id);
    expect(ctx.tenantId).not.toBe(tenantAdulterado.id);
  });
});
