/**
 * Seed sintético do modelo físico (FIT-007). Nenhum dado real de aluno ou
 * personal — apenas dados fictícios para demonstrar e validar o isolamento
 * entre tenants localmente.
 */
import { PrismaClient } from "@prisma/client";
import { publishPlanVersion } from "../src/modules/saas-subscription/plans";

const prisma = new PrismaClient();

async function main() {
  // Hipótese comercial do pacote pós-MVP (01_FASE_2_1_MONETIZACAO.md,
  // FIT-090) — não é preço definitivo, só dado sintético para exercitar o
  // catálogo de planos antes da FIT-092 (checkout).
  await publishPlanVersion(
    { code: "essencial", name: "Essencial", billingCycle: "MENSAL", priceCents: 3990, studentLimit: 15, trialDays: 14 },
    prisma
  );
  await publishPlanVersion(
    {
      code: "essencial",
      name: "Essencial (anual)",
      billingCycle: "ANUAL",
      priceCents: 3990 * 12,
      studentLimit: 15,
      trialDays: 14,
      discountPercent: 10,
    },
    prisma
  );
  await publishPlanVersion(
    { code: "profissional", name: "Profissional", billingCycle: "MENSAL", priceCents: 7990, studentLimit: 50, trialDays: 14 },
    prisma
  );
  await publishPlanVersion(
    {
      code: "profissional",
      name: "Profissional (anual)",
      billingCycle: "ANUAL",
      priceCents: 7990 * 12,
      studentLimit: 50,
      trialDays: 14,
      discountPercent: 10,
    },
    prisma
  );

  const tenantAOwner = await prisma.user.create({
    data: { email: "personal-a@example.test", name: "Personal Fictício A" },
  });
  const tenantA = await prisma.tenant.create({
    data: { ownerId: tenantAOwner.id, name: "Tenant Fictício A" },
  });
  const studentAUser = await prisma.user.create({
    data: { email: "aluno-a@example.test", name: "Aluno Fictício A" },
  });
  const studentA = await prisma.student.create({
    data: { tenantId: tenantA.id, userId: studentAUser.id, email: studentAUser.email, displayName: "Aluno Fictício A" },
  });

  const tenantBOwner = await prisma.user.create({
    data: { email: "personal-b@example.test", name: "Personal Fictício B" },
  });
  const tenantB = await prisma.tenant.create({
    data: { ownerId: tenantBOwner.id, name: "Tenant Fictício B" },
  });
  const studentBUser = await prisma.user.create({
    data: { email: "aluno-b@example.test", name: "Aluno Fictício B" },
  });
  const studentB = await prisma.student.create({
    data: { tenantId: tenantB.id, userId: studentBUser.id, email: studentBUser.email, displayName: "Aluno Fictício B" },
  });

  await prisma.saasSubscription.createMany({
    data: [
      { tenantId: tenantA.id, provider: "sandbox" },
      { tenantId: tenantB.id, provider: "sandbox" },
    ],
  });

  await prisma.studentCharge.createMany({
    data: [
      {
        tenantId: tenantA.id,
        studentId: studentA.id,
        description: "Mensalidade",
        amountCents: 15000,
        referenceMonth: new Date("2026-10-01"),
        dueDate: new Date("2026-10-05"),
      },
      {
        tenantId: tenantB.id,
        studentId: studentB.id,
        description: "Mensalidade",
        amountCents: 18000,
        referenceMonth: new Date("2026-10-01"),
        dueDate: new Date("2026-10-10"),
      },
    ],
  });

  console.log("Seed sintético aplicado: 2 tenants, 2 alunos, 2 assinaturas SaaS, 2 cobranças.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
