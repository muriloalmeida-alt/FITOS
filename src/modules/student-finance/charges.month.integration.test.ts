// @vitest-environment node
//
// FIT-148 (EPIC-19): "Gerar todas" as mensalidades do mês (BK-09) e
// cobrança com "Repetir todo mês" numa transação só (BK-10).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  StudentChargeError,
  countPendingRecurrencesForMonth,
  createChargeWithOptionalRecurrence,
  generateChargeForRecurrenceMonth,
  generateMonthChargesForRecurrences,
} from "./charges";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.chargeRecurrence.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Dono", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  const student = (name: string, status: "ATIVO" | "INATIVO" = "ATIVO") =>
    prisma.student.create({ data: { tenantId: tenant.id, email: `${name}-${label}-${run}@example.test`, displayName: name, status } });
  return { tenant, student };
}

const october = new Date(Date.UTC(2026, 9, 1));
const november = new Date(Date.UTC(2026, 10, 1));

describe("generateMonthChargesForRecurrences (BK-09)", () => {
  it("gera uma por recorrência ativa de aluno ativo, sem duplicar nem gerar mês retroativo", async () => {
    const { tenant, student } = await setup("bk09");
    const ana = await student("Ana");
    const bia = await student("Bia");
    const inativa = await student("Cris", "INATIVO");
    const rec = (studentId: string, extra: Record<string, unknown> = {}) =>
      prisma.chargeRecurrence.create({ data: { tenantId: tenant.id, studentId, description: "Mensalidade", amountCents: 20000, dueDayOfMonth: 10, createdAt: new Date(Date.UTC(2026, 8, 15)), ...extra } });
    const anaRec = await rec(ana.id);
    await rec(bia.id);
    await rec(inativa.id);
    await rec(bia.id, { status: "ENCERRADA" });
    await rec(bia.id, { createdAt: new Date(Date.UTC(2026, 10, 2)) });
    // Ana já tem outubro.
    await generateChargeForRecurrenceMonth({ tenantId: tenant.id, recurrenceId: anaRec.id, referenceMonth: october }, prisma);

    expect(await countPendingRecurrencesForMonth({ tenantId: tenant.id, referenceMonth: october }, prisma)).toBe(1);
    expect(await generateMonthChargesForRecurrences({ tenantId: tenant.id, referenceMonth: october }, prisma)).toEqual({ created: 1, existing: 1 });
    expect(await generateMonthChargesForRecurrences({ tenantId: tenant.id, referenceMonth: october }, prisma)).toEqual({ created: 0, existing: 2 });
    expect(await countPendingRecurrencesForMonth({ tenantId: tenant.id, referenceMonth: october }, prisma)).toBe(0);

    const charges = await prisma.studentCharge.findMany({ where: { tenantId: tenant.id, referenceMonth: october } });
    expect(charges).toHaveLength(2);
    expect(charges.every((charge) => charge.dueDate.toISOString() === "2026-10-10T00:00:00.000Z")).toBe(true);
    expect(await generateMonthChargesForRecurrences({ tenantId: tenant.id, referenceMonth: november }, prisma)).toEqual({ created: 3, existing: 0 });
  });

  it("recorrência de outro tenant não é encontrada", async () => {
    const mine = await setup("own");
    const other = await setup("alheio");
    const stranger = await other.student("Alheio");
    const recurrence = await prisma.chargeRecurrence.create({ data: { tenantId: other.tenant.id, studentId: stranger.id, description: "M", amountCents: 100, dueDayOfMonth: 5 } });
    await expect(generateChargeForRecurrenceMonth({ tenantId: mine.tenant.id, recurrenceId: recurrence.id, referenceMonth: october }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("createChargeWithOptionalRecurrence (BK-10)", () => {
  it("com 'Repetir todo mês' cria recorrência e lançamento ligados; sem, só o lançamento", async () => {
    const { tenant, student } = await setup("bk10");
    const ana = await student("Ana");

    const repeated = await createChargeWithOptionalRecurrence(
      { tenantId: tenant.id, studentId: ana.id, description: "Mensalidade", amountReais: 180, referenceMonth: october, dueDayOfMonth: 5, repeatMonthly: true },
      prisma
    );
    expect(repeated.recurrence).toMatchObject({ amountCents: 18000, dueDayOfMonth: 5, status: "ATIVA" });
    expect(repeated.charge).toMatchObject({ amountCents: 18000, recurrenceId: repeated.recurrence!.id, status: "PENDENTE" });
    expect(repeated.charge.dueDate.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    // Gerar o mês depois não duplica outubro.
    expect(await generateMonthChargesForRecurrences({ tenantId: tenant.id, referenceMonth: october }, prisma)).toEqual({ created: 0, existing: 1 });

    const single = await createChargeWithOptionalRecurrence(
      { tenantId: tenant.id, studentId: ana.id, description: "Avaliação", amountReais: 90, referenceMonth: october, dueDayOfMonth: 20, repeatMonthly: false },
      prisma
    );
    expect(single.recurrence).toBeNull();
    expect(single.charge.recurrenceId).toBeNull();
  });

  it("valida o dia de vencimento antes de gravar qualquer coisa", async () => {
    const { tenant, student } = await setup("bk10v");
    const ana = await student("Ana");
    await expect(
      createChargeWithOptionalRecurrence({ tenantId: tenant.id, studentId: ana.id, description: "M", amountReais: 10, referenceMonth: october, dueDayOfMonth: 31, repeatMonthly: true }, prisma)
    ).rejects.toBeInstanceOf(StudentChargeError);
    expect(await prisma.chargeRecurrence.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
