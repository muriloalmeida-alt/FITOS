// @vitest-environment node
//
// Testes de integração do auto-provisionamento do Student de auto-
// referência do praticante individual (FIT-103) contra um PostgreSQL
// real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureStudentForIndividual } from "./ensureStudentForIndividual";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.student.deleteMany({ where: { user: { email: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { owner: { email: { contains: run } } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createIndividualTenant(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${run}@example.test`, name: `${label} de teste`, role: "INDIVIDUAL" },
  });
  const tenant = await prisma.tenant.create({
    data: { ownerId: user.id, name: `Espaço de ${label}`, type: "INDIVIDUAL" },
  });
  return { user, tenant };
}

describe("ensureStudentForIndividual (FIT-103)", () => {
  it("cria um Student de auto-referência (userId === ownerId do tenant)", async () => {
    const { user, tenant } = await createIndividualTenant("normal");

    const student = await ensureStudentForIndividual(tenant, prisma);

    expect(student.tenantId).toBe(tenant.id);
    expect(student.userId).toBe(user.id);
    expect(student.email).toBe(user.email);
    expect(student.displayName).toBe(user.name);

    const count = await prisma.student.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  it("idempotência: chamar novamente retorna o mesmo Student, sem duplicar", async () => {
    const { tenant } = await createIndividualTenant("idempotente");

    const first = await ensureStudentForIndividual(tenant, prisma);
    const second = await ensureStudentForIndividual(tenant, prisma);

    expect(second.id).toBe(first.id);
    const count = await prisma.student.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(1);
  });

  it("concorrência: chamadas simultâneas resultam em um único Student", async () => {
    const { tenant } = await createIndividualTenant("concorrente");

    const [a, b, c] = await Promise.all([
      ensureStudentForIndividual(tenant, prisma),
      ensureStudentForIndividual(tenant, prisma),
      ensureStudentForIndividual(tenant, prisma),
    ]);

    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    const count = await prisma.student.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(1);
  });

  it("tenant com Student já existente: retorna o existente sem criar um segundo", async () => {
    const { user, tenant } = await createIndividualTenant("com-student-previo");
    const preexisting = await prisma.student.create({
      data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: "Nome definido antes" },
    });

    const student = await ensureStudentForIndividual(tenant, prisma);

    expect(student.id).toBe(preexisting.id);
    const count = await prisma.student.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(1);
  });
});
