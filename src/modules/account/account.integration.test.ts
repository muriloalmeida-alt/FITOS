// @vitest-environment node
//
// Seus dados (Configurações, EPIC-37) contra PostgreSQL real: exportar os
// dados do espaço e a própria pessoa excluir a conta.
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { buildPersonalExport } from "./personalExport";
import { deleteOwnAccount } from "./deleteAccount";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.payment.deleteMany({ where });
  await prisma.studentCharge.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function personal(label: string, password: string | null = "senha-forte-123") {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
  if (password) await prisma.account.create({ data: { userId: owner.id, accountId: owner.id, providerId: "credential", password: await hashPassword(password) } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  return { owner, tenant };
}

function unzip(zip: Uint8Array): Record<string, string> {
  const dir = mkdtempSync(path.join(tmpdir(), "export-"));
  const file = path.join(dir, "dados.zip");
  writeFileSync(file, zip);
  execFileSync("unzip", ["-o", "-q", file, "-d", dir]);
  const names = execFileSync("unzip", ["-Z1", file]).toString().trim().split("\n");
  return Object.fromEntries(names.map((name) => [name, readFileSync(path.join(dir, name), "utf8")]));
}

describe("baixar meus dados (EPIC-37)", () => {
  it("ZIP com as planilhas do espaço, só do próprio espaço", async () => {
    const { owner, tenant } = await personal("export");
    const ana = await prisma.student.create({ data: { tenantId: tenant.id, email: `ana-${run}@example.test`, displayName: "Ana; Costa", preferredDays: ["SEGUNDA", "QUINTA"] } });
    const charge = await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: ana.id, description: "Mensalidade outubro", amountCents: 15000, referenceMonth: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-10T15:00:00Z") } });
    await prisma.payment.create({ data: { tenantId: tenant.id, studentChargeId: charge.id, amountCentsPaid: 15000, paidAt: new Date("2026-10-09T15:00:00Z"), method: "PIX", recordedByUserId: owner.id } });
    const assessment = await prisma.assessment.create({ data: { tenantId: tenant.id, studentId: ana.id, authorUserId: owner.id, weightGrams: 68500, recordedAt: new Date("2026-10-01T15:00:00Z") } });
    await prisma.bodyMeasurement.create({ data: { tenantId: tenant.id, assessmentId: assessment.id, type: "BRACO", valueMillimeters: 305 } });
    const { tenant: other } = await personal("export-outro");
    await prisma.student.create({ data: { tenantId: other.id, email: `pedro-${run}@example.test`, displayName: "Pedro Outro" } });

    const { filename, zip } = await buildPersonalExport({ tenantId: tenant.id, now: new Date("2026-10-05T13:00:00Z") }, prisma);
    expect(filename).toBe("fitos-dados-2026-10-05.zip");
    const files = unzip(zip);
    expect(Object.keys(files).sort()).toEqual(["LEIA-ME.txt", "alunos.csv", "avaliacoes.csv", "cobrancas.csv", "fichas-de-saude.csv", "metas.csv", "programas-e-treinos.csv", "series-registradas.csv", "treinos-realizados.csv"]);
    expect(files["LEIA-ME.txt"]).toContain(`Studio export ${run}`);
    expect(files["alunos.csv"]).toContain(`"Ana; Costa";ana-${run}@example.test;Ativo;Não;;Seg, Qui`);
    expect(files["alunos.csv"]).not.toContain("Pedro Outro");
    expect(files["cobrancas.csv"]).toContain('"Ana; Costa";Mensalidade outubro;10/10/2026;150;Paga;09/10/2026;150;PIX;');
    expect(files["avaliacoes.csv"]).toMatch(/Data;Aluno;Peso \(kg\);Gordura \(%\);Braço \(cm\);Observações\r\n01\/10\/2026;"Ana; Costa";68,5;;30,5;/);
  });
});

describe("excluir minha conta (EPIC-37)", () => {
  it("com senha: recusa a senha errada e apaga o espaço com a certa", async () => {
    const { owner, tenant } = await personal("excluir");
    await prisma.student.create({ data: { tenantId: tenant.id, email: `bia-${run}@example.test`, displayName: "Bia" } });
    await expect(deleteOwnAccount({ userId: owner.id, password: "errada-123" }, prisma)).rejects.toMatchObject({ kind: "SENHA_INCORRETA" });
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();

    await deleteOwnAccount({ userId: owner.id, password: "senha-forte-123" }, prisma);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await prisma.tenant.findUnique({ where: { id: tenant.id } })).toBeNull();
    expect(await prisma.student.count({ where: { tenantId: tenant.id } })).toBe(0);
  });

  it("sem senha (só digital): confirma digitando EXCLUIR", async () => {
    const { owner } = await personal("sem-senha", null);
    await expect(deleteOwnAccount({ userId: owner.id, confirmation: "apagar" }, prisma)).rejects.toMatchObject({ kind: "CONFIRMACAO" });
    await deleteOwnAccount({ userId: owner.id, confirmation: " excluir " }, prisma);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
  });

  it("administrador não sai por aqui", async () => {
    const admin = await prisma.user.create({ data: { email: `admin-${run}@example.test`, name: "Admin", role: "ADMIN" } });
    await expect(deleteOwnAccount({ userId: admin.id, confirmation: "EXCLUIR" }, prisma)).rejects.toMatchObject({ kind: "PROIBIDO" });
  });
});
