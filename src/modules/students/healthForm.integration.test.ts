// @vitest-environment node
//
// Ficha de saúde (EPIC-46) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { saveSubscription, type Sender } from "@/modules/notifications/push";
import { getHealthForm, saveHealthForm } from "./healthForm";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const config = { publicKey: "pub", privateKey: "priv", subject: "mailto:t@t.test" };
const answers = (yes: number[] = []) => ({ parq: [0, 1, 2, 3, 4, 5, 6].map((index) => yes.includes(index)), conditions: ["HIPERTENSAO", "INVENTADA"], injuries: " Joelho operado em 2022 ", medications: "", pain: "", activity: "IRREGULAR", notes: "" });

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.healthForm.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("ficha de saúde (EPIC-46)", () => {
  it("aluno responde: limpa, conta o PAR-Q e avisa o personal; personal corrige sem aviso", async () => {
    const owner = await prisma.user.create({ data: { email: `dono-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    await saveSubscription({ userId: owner.id, subscription: { endpoint: `https://push.example/dono-${run}`, keys: { p256dh: "p", auth: "a" } }, userAgent: null }, prisma);
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${run}` } });
    const user = await prisma.user.create({ data: { email: `ana-${run}@example.test`, name: "Ana", role: "ALUNO" } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: "Ana Costa" } });
    const scope = { tenantId: tenant.id, studentId: student.id };
    expect(await getHealthForm(scope, prisma)).toBeNull();

    const sent: { title: string; body: string; url: string }[] = [];
    const sender: Sender = async (_subscription, payload) => void sent.push(JSON.parse(payload));
    const saved = await saveHealthForm({ ...scope, actorUserId: user.id, answers: answers([0, 5]) }, { client: prisma, sender, config });
    expect(saved).toMatchObject({ parqYes: 2, filledBySelf: true });
    expect(saved.answers).toMatchObject({ conditions: ["HIPERTENSAO"], injuries: "Joelho operado em 2022", activity: "IRREGULAR" });
    expect(sent).toEqual([expect.objectContaining({ title: "Ana respondeu a ficha de saúde", body: "2 respostas pedem atenção no PAR-Q.", url: `/painel/alunos/${student.id}/saude` })]);

    const byCoach = await saveHealthForm({ ...scope, actorUserId: owner.id, answers: answers() }, { client: prisma, sender, config });
    expect(byCoach).toMatchObject({ parqYes: 0, filledBySelf: false });
    expect(sent).toHaveLength(1);
    expect(await getHealthForm(scope, prisma)).toMatchObject({ parqYes: 0, filledBySelf: false });
  });

  it("valida respostas e o aluno do espaço", async () => {
    const owner = await prisma.user.create({ data: { email: `dono2-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
    const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio 2 ${run}` } });
    const otherOwner = await prisma.user.create({ data: { email: `dono3-${run}@example.test`, name: "Outro", role: "PERSONAL" } });
    const other = await prisma.tenant.create({ data: { ownerId: otherOwner.id, name: `Studio 3 ${run}` } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `bia-${run}@example.test`, displayName: "Bia" } });
    const save = (tenantId: string, raw: unknown) => saveHealthForm({ tenantId, studentId: student.id, actorUserId: owner.id, answers: raw }, { client: prisma, config: null });
    await expect(save(tenant.id, { ...answers(), parq: [true] })).rejects.toThrow("Responda todas as perguntas");
    await expect(save(tenant.id, { ...answers(), activity: "X" })).rejects.toThrow("rotina");
    await expect(save(tenant.id, { ...answers(), notes: "x".repeat(1001) })).rejects.toThrow("até 1000 caracteres");
    await expect(save(other.id, answers())).rejects.toThrow("Aluno não encontrado.");
  });
});
