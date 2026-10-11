// @vitest-environment node
//
// EPIC-33: quem entra pelo link já recebe o programa e a mensalidade que o
// personal escolheu nos primeiros passos. PostgreSQL real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { getLibrary } from "@/modules/library/library";
import { getInviteDefaults, getOrCreateInviteCode, joinByInviteLink, setInviteDefaults } from "./inviteLink";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  user: { additionalFields: { role: { type: "string", required: true, defaultValue: "PERSONAL", input: false } } },
  advanced: { database: { generateId: false } },
});

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
}, 60_000);

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.chargeRecurrence.deleteMany({ where });
  await prisma.planAssignment.deleteMany({ where });
  await prisma.auditEvent.deleteMany({ where });
  await prisma.invitation.deleteMany({ where });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" DISABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" DISABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.workoutExercise.deleteMany({ where });
  await prisma.workout.deleteMany({ where });
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" ENABLE TRIGGER workouts_snapshot_immutability_guard`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workout_exercises" ENABLE TRIGGER workout_exercises_snapshot_immutability_guard`);
  await prisma.trainingPlan.deleteMany({ where });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("o combinado do convite (EPIC-33)", () => {
  it("programa e mensalidade escolhidos valem para quem entra pelo link", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const library = await getLibrary({ tenantId: tenant.id }, prisma);
    const program = library.programs.find((entry) => entry.name === "Corpo todo 3× · 45 min")!;

    expect(await getInviteDefaults(tenant.id, prisma)).toEqual({ programId: null, programName: null, feeCents: null, feeDay: null });
    await expect(setInviteDefaults({ tenantId: tenant.id, programId: "nao-existe" }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await expect(setInviteDefaults({ tenantId: tenant.id, feeDay: 31 }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
    await setInviteDefaults({ tenantId: tenant.id, programId: program.id }, prisma);
    expect(await setInviteDefaults({ tenantId: tenant.id, feeCents: 15000, feeDay: 10 }, prisma)).toEqual({ programId: program.id, programName: "Corpo todo 3× · 45 min", feeCents: 15000, feeDay: 10 });

    const code = await getOrCreateInviteCode(tenant.id, prisma);
    const { studentId } = await joinByInviteLink({ code, name: "Ana Costa", email: `ana-${run}@example.test`, password: "senha-forte-123" }, prisma, testAuth);

    const assignment = await prisma.planAssignment.findFirstOrThrow({ where: { studentId, active: true }, include: { trainingPlan: true } });
    expect(assignment.trainingPlan).toMatchObject({ name: "Corpo todo 3× · 45 min", isSnapshot: true });
    expect(assignment.trainingPlanId).not.toBe(program.id);
    expect(await prisma.chargeRecurrence.findFirstOrThrow({ where: { studentId } })).toMatchObject({ amountCents: 15000, dueDayOfMonth: 10, status: "ATIVA" });
  });
});
