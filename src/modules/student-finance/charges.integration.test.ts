// @vitest-environment node
//
// Testes de integração de cobrança (FIT-050) contra PostgreSQL real
// (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { cancelStudentCharge, createStudentCharge, listChargesForStudent, refreshOverdueCharges, registerPayment } from "./charges";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.studentCharge.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

async function createStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` },
  });
}

describe("createStudentCharge (FIT-050)", () => {
  it("cadastra cobrança sempre iniciando pendente, convertendo reais para centavos", async () => {
    const { tenant } = await createTenant("criar");
    const student = await createStudent(tenant.id, "criar");

    const charge = await createStudentCharge(
      {
        tenantId: tenant.id,
        studentId: student.id,
        description: "Mensalidade outubro",
        amountReais: 150.5,
        referenceMonth: new Date("2026-10-15"),
        dueDate: new Date("2026-10-05"),
      },
      prisma
    );

    expect(charge.status).toBe("PENDENTE");
    expect(charge.amountCents).toBe(15050);
    expect(charge.referenceMonth.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(charge.description).toBe("Mensalidade outubro");
  });

  it("rejeita valor não positivo e descrição vazia", async () => {
    const { tenant } = await createTenant("invalido");
    const student = await createStudent(tenant.id, "invalido");

    await expect(
      createStudentCharge(
        { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 0, referenceMonth: new Date(), dueDate: new Date() },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    await expect(
      createStudentCharge(
        { tenantId: tenant.id, studentId: student.id, description: "  ", amountReais: 100, referenceMonth: new Date(), dueDate: new Date() },
        prisma
      )
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });

  it("rejeita aluno que não pertence ao tenant informado", async () => {
    const { tenant: tenantA } = await createTenant("cruzado-a");
    const { tenant: tenantB } = await createTenant("cruzado-b");
    const studentB = await createStudent(tenantB.id, "cruzado");

    await expect(
      createStudentCharge(
        { tenantId: tenantA.id, studentId: studentB.id, description: "Mensalidade", amountReais: 100, referenceMonth: new Date(), dueDate: new Date() },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("listChargesForStudent / refreshOverdueCharges (FIT-050)", () => {
  it("lista competência mais recente primeiro e nunca mistura aluno de outro tenant", async () => {
    const { tenant: tenantA } = await createTenant("listar-a");
    const { tenant: tenantB } = await createTenant("listar-b");
    const studentA = await createStudent(tenantA.id, "listar");
    const studentB = await createStudent(tenantB.id, "listar");

    const setembro = await createStudentCharge(
      { tenantId: tenantA.id, studentId: studentA.id, description: "Set", amountReais: 100, referenceMonth: new Date("2026-09-10"), dueDate: new Date("2026-09-05") },
      prisma
    );
    const outubro = await createStudentCharge(
      { tenantId: tenantA.id, studentId: studentA.id, description: "Out", amountReais: 100, referenceMonth: new Date("2026-10-10"), dueDate: new Date("2026-10-05") },
      prisma
    );
    await createStudentCharge(
      { tenantId: tenantB.id, studentId: studentB.id, description: "Set (outro tenant)", amountReais: 100, referenceMonth: new Date("2026-09-10"), dueDate: new Date("2026-09-05") },
      prisma
    );

    const lista = await listChargesForStudent({ tenantId: tenantA.id, studentId: studentA.id }, prisma);

    expect(lista.map((c) => c.id)).toEqual([outubro.id, setembro.id]);
  });

  it("marca pendente como atrasado quando o vencimento já passou, mas nunca quando vence hoje ou no futuro", async () => {
    const { tenant } = await createTenant("atraso");
    const student = await createStudent(tenant.id, "atraso");
    const ontem = new Date();
    ontem.setUTCDate(ontem.getUTCDate() - 1);
    const amanha = new Date();
    amanha.setUTCDate(amanha.getUTCDate() + 1);

    const vencida = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Vencida", amountReais: 100, referenceMonth: new Date(), dueDate: ontem },
      prisma
    );
    const aVencer = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "A vencer", amountReais: 100, referenceMonth: new Date(), dueDate: amanha },
      prisma
    );

    await refreshOverdueCharges({ tenantId: tenant.id }, prisma);

    const vencidaAtualizada = await prisma.studentCharge.findUniqueOrThrow({ where: { id: vencida.id } });
    const aVencerAtualizada = await prisma.studentCharge.findUniqueOrThrow({ where: { id: aVencer.id } });
    expect(vencidaAtualizada.status).toBe("ATRASADO");
    expect(aVencerAtualizada.status).toBe("PENDENTE");
  });
});

describe("cancelStudentCharge (FIT-050)", () => {
  it("cancela exigindo motivo, e é idempotente para uma já cancelada", async () => {
    const { tenant } = await createTenant("cancelar");
    const student = await createStudent(tenant.id, "cancelar");
    const charge = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 100, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );

    await expect(cancelStudentCharge({ tenantId: tenant.id, chargeId: charge.id, reason: "" }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });

    const cancelada = await cancelStudentCharge({ tenantId: tenant.id, chargeId: charge.id, reason: "Aluno cancelou o plano" }, prisma);
    expect(cancelada.status).toBe("CANCELADO");
    expect(cancelada.cancelReason).toBe("Aluno cancelou o plano");
    expect(cancelada.cancelledAt).not.toBeNull();

    const canceladaDeNovo = await cancelStudentCharge({ tenantId: tenant.id, chargeId: charge.id, reason: "outro motivo" }, prisma);
    expect(canceladaDeNovo.cancelReason).toBe("Aluno cancelou o plano");
  });

  it("nunca cancela fisicamente e rejeita cancelar cobrança já paga", async () => {
    const { tenant } = await createTenant("cancelar-paga");
    const student = await createStudent(tenant.id, "cancelar-paga");
    const charge = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 100, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );
    await prisma.studentCharge.update({ where: { id: charge.id }, data: { status: "PAGO" } });

    await expect(cancelStudentCharge({ tenantId: tenant.id, chargeId: charge.id, reason: "motivo" }, prisma)).rejects.toMatchObject({
      kind: "ESTADO_INVALIDO",
    });
  });

  it("rejeita cancelar cobrança de outro tenant (NAO_ENCONTRADO)", async () => {
    const { tenant: tenantA } = await createTenant("cancelar-cruzado-a");
    const { tenant: tenantB } = await createTenant("cancelar-cruzado-b");
    const studentA = await createStudent(tenantA.id, "cancelar-cruzado");
    const charge = await createStudentCharge(
      { tenantId: tenantA.id, studentId: studentA.id, description: "Mensalidade", amountReais: 100, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );

    await expect(
      cancelStudentCharge({ tenantId: tenantB.id, chargeId: charge.id, reason: "motivo" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("registerPayment (FIT-051)", () => {
  it("registra o pagamento, marca a cobrança como paga e audita a ação", async () => {
    const { tenant, owner } = await createTenant("pagar");
    const student = await createStudent(tenant.id, "pagar");
    const charge = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 150, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );

    const paga = await registerPayment(
      { tenantId: tenant.id, actorUserId: owner.id, chargeId: charge.id, amountReceivedReais: 150, paidAt: new Date("2026-10-04"), method: "PIX" },
      prisma
    );

    expect(paga.status).toBe("PAGO");
    const payment = await prisma.payment.findUnique({ where: { studentChargeId: charge.id } });
    expect(payment?.amountCentsPaid).toBe(15000);
    expect(payment?.method).toBe("PIX");
    expect(payment?.recordedByUserId).toBe(owner.id);
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "StudentCharge", entityId: charge.id } });
    expect(audit?.action).toBe("PAGAMENTO_REGISTRADO");
    expect(audit?.actorUserId).toBe(owner.id);
  });

  it("rejeita data/valor ausentes e um segundo pagamento para a mesma cobrança", async () => {
    const { tenant, owner } = await createTenant("pagar-invalido");
    const student = await createStudent(tenant.id, "pagar-invalido");
    const charge = await createStudentCharge(
      { tenantId: tenant.id, studentId: student.id, description: "Mensalidade", amountReais: 150, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );

    await expect(
      registerPayment({ tenantId: tenant.id, actorUserId: owner.id, chargeId: charge.id, amountReceivedReais: 0, paidAt: new Date(), method: "PIX" }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });

    await registerPayment(
      { tenantId: tenant.id, actorUserId: owner.id, chargeId: charge.id, amountReceivedReais: 150, paidAt: new Date(), method: "PIX" },
      prisma
    );

    await expect(
      registerPayment({ tenantId: tenant.id, actorUserId: owner.id, chargeId: charge.id, amountReceivedReais: 150, paidAt: new Date(), method: "PIX" }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });
  });

  it("rejeita pagar cobrança cancelada e cobrança de outro tenant", async () => {
    const { tenant: tenantA, owner: ownerA } = await createTenant("pagar-cancelada-a");
    const { tenant: tenantB, owner: ownerB } = await createTenant("pagar-cancelada-b");
    const studentA = await createStudent(tenantA.id, "pagar-cancelada");
    const charge = await createStudentCharge(
      { tenantId: tenantA.id, studentId: studentA.id, description: "Mensalidade", amountReais: 150, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );
    await cancelStudentCharge({ tenantId: tenantA.id, chargeId: charge.id, reason: "motivo" }, prisma);

    await expect(
      registerPayment({ tenantId: tenantA.id, actorUserId: ownerA.id, chargeId: charge.id, amountReceivedReais: 150, paidAt: new Date(), method: "PIX" }, prisma)
    ).rejects.toMatchObject({ kind: "ESTADO_INVALIDO" });

    const charge2 = await createStudentCharge(
      { tenantId: tenantA.id, studentId: studentA.id, description: "Mensalidade 2", amountReais: 150, referenceMonth: new Date(), dueDate: new Date() },
      prisma
    );
    await expect(
      registerPayment({ tenantId: tenantB.id, actorUserId: ownerB.id, chargeId: charge2.id, amountReceivedReais: 150, paidAt: new Date(), method: "PIX" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
