// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
const { ensureCuratedCatalog, exerciseUpdateStatements } = await import("./ensureCatalog");

const MIGRATIONS = path.join(process.cwd(), "prisma", "migrations");

describe("exerciseUpdateStatements", () => {
  it("pega UPDATE simples e com WITH, inteiros, e ignora o resto", () => {
    const sql = [
      'ALTER TABLE "exercises" ADD COLUMN "x" TEXT;',
      'UPDATE "exercises" SET "instructions" = \'Passo 1; passo 2\' WHERE "id" = \'a\';',
      "WITH novas(id, arquivo) AS (VALUES",
      "  ('a', 'a.webp')",
      ")",
      'UPDATE "exercises" e',
      "SET \"imageUrl\" = n.arquivo",
      "FROM novas n WHERE e.id = n.id",
      ";",
      "WITH outra AS (SELECT 1)",
      'UPDATE "plans" SET "name" = \'x\';',
      'INSERT INTO "exercises" ("id") VALUES (\'b\') ON CONFLICT DO NOTHING;',
    ].join("\n");
    const statements = exerciseUpdateStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("Passo 1; passo 2");
    expect(statements[1]!.startsWith("WITH novas")).toBe(true);
    expect(statements[1]!.trim().endsWith(";")).toBe(true);
  });

  it("as migrations do repositório têm os ajustes do catálogo (imagens, aeróbicos, Funcional)", () => {
    const all = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => exerciseUpdateStatements(readFileSync(path.join(MIGRATIONS, entry.name, "migration.sql"), "utf-8")));
    expect(all.length).toBeGreaterThanOrEqual(71);
    expect(all.filter((statement) => statement.startsWith("WITH"))).toHaveLength(2);
  });
});

describe("ensureCuratedCatalog", () => {
  it("com o catálogo completo, não faz nada", async () => {
    const transaction = vi.fn();
    const client = { exercise: { findMany: vi.fn(async () => [{ externalId: "fitos:a" }]) }, $transaction: transaction } as unknown as PrismaClient;
    const record = { externalId: "fitos:a" } as never;
    expect(await ensureCuratedCatalog({ records: [record], migrations: [] }, client)).toEqual({ created: 0, replayed: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
