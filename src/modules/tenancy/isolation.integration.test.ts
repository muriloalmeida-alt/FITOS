// @vitest-environment node
//
// Testes de isolamento multi-tenant contra um PostgreSQL real (banco de
// testes, aplicado via `prisma migrate deploy`). Usam apenas dados
// sintéticos criados e removidos pelo próprio teste — nenhum dado real.
//
// Exigem DATABASE_URL configurada (ver docs/06-engenharia/EXECUCAO-LOCAL.md)
// e as migrations aplicadas no banco de testes (`fitos_test`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let tenantA: { id: string };
let tenantB: { id: string };
let studentA: { id: string };
let studentB: { id: string };

beforeAll(async () => {
  const ownerA = await prisma.user.create({
    data: { email: `owner-a-${run}@example.test`, name: "Personal de teste A" },
  });
  tenantA = await prisma.tenant.create({
    data: { ownerId: ownerA.id, name: `Tenant de teste A ${run}` },
  });
  const studentUserA = await prisma.user.create({
    data: { email: `aluno-a-${run}@example.test`, name: "Aluno de teste A" },
  });
  studentA = await prisma.student.create({
    data: { tenantId: tenantA.id, userId: studentUserA.id, displayName: "Aluno de teste A" },
  });

  const ownerB = await prisma.user.create({
    data: { email: `owner-b-${run}@example.test`, name: "Personal de teste B" },
  });
  tenantB = await prisma.tenant.create({
    data: { ownerId: ownerB.id, name: `Tenant de teste B ${run}` },
  });
  const studentUserB = await prisma.user.create({
    data: { email: `aluno-b-${run}@example.test`, name: "Aluno de teste B" },
  });
  studentB = await prisma.student.create({
    data: { tenantId: tenantB.id, userId: studentUserB.id, displayName: "Aluno de teste B" },
  });
});

afterAll(async () => {
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  await prisma.user.deleteMany({
    where: { email: { contains: run } },
  });
  await prisma.$disconnect();
});

describe("isolamento entre tenants", () => {
  it("consulta escopada por tenant nunca retorna aluno de outro tenant", async () => {
    const studentsOfA = await prisma.student.findMany({ where: { tenantId: tenantA.id } });

    expect(studentsOfA.map((s) => s.id)).toContain(studentA.id);
    expect(studentsOfA.map((s) => s.id)).not.toContain(studentB.id);
  });

  it("update escopado por tenant errado não afeta nenhuma linha (acesso cruzado)", async () => {
    const result = await prisma.student.updateMany({
      where: { id: studentB.id, tenantId: tenantA.id },
      data: { displayName: "Tentativa de acesso cruzado" },
    });

    expect(result.count).toBe(0);

    const untouched = await prisma.student.findUniqueOrThrow({ where: { id: studentB.id } });
    expect(untouched.displayName).toBe("Aluno de teste B");
  });

  it("delete escopado por tenant errado não remove aluno de outro tenant", async () => {
    const result = await prisma.student.deleteMany({
      where: { id: studentA.id, tenantId: tenantB.id },
    });

    expect(result.count).toBe(0);

    const stillThere = await prisma.student.findUnique({ where: { id: studentA.id } });
    expect(stillThere).not.toBeNull();
  });
});

describe("constraints de tenancy (1 personal = 1 tenant; aluno = 1 tenant)", () => {
  it("impede um segundo tenant para o mesmo owner (1 personal = 1 tenant)", async () => {
    await expect(
      prisma.tenant.create({
        data: { ownerId: (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantA.id } })).ownerId, name: "Tenant duplicado" },
      })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it("impede vincular o mesmo aluno (userId) a um segundo tenant", async () => {
    await expect(
      prisma.student.create({
        data: {
          tenantId: tenantB.id,
          userId: (await prisma.student.findUniqueOrThrow({ where: { id: studentA.id } })).userId,
          displayName: "Vínculo duplicado",
        },
      })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it("impede uma segunda assinatura SaaS para o mesmo tenant", async () => {
    await prisma.saasSubscription.create({ data: { tenantId: tenantA.id, provider: "sandbox" } });

    await expect(
      prisma.saasSubscription.create({ data: { tenantId: tenantA.id, provider: "sandbox" } })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);

    await prisma.saasSubscription.deleteMany({ where: { tenantId: tenantA.id } });
  });
});

describe("separação entre StudentCharge e SaasSubscription", () => {
  it("StudentCharge e SaasSubscription do mesmo tenant não têm nenhuma relação entre si", () => {
    const chargeFields = Prisma.dmmf.datamodel.models.find((m) => m.name === "StudentCharge")?.fields ?? [];
    const subscriptionFields = Prisma.dmmf.datamodel.models.find((m) => m.name === "SaasSubscription")?.fields ?? [];

    expect(chargeFields.some((f) => f.type === "SaasSubscription")).toBe(false);
    expect(subscriptionFields.some((f) => f.type === "StudentCharge")).toBe(false);
  });
});
