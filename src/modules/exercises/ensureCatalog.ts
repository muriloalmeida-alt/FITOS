import "server-only";
import type { PrismaClient } from "@prisma/client";
import { exerciseSearchText } from "@/shared/lib/exerciseCatalog";
import { curatedExerciseData, type CuratedExerciseRecord } from "./importCuratedCatalog";

/// Catálogo global num banco novo (produção). As migrations de dados que
/// enriquecem o catálogo curado (imagens, aeróbicos, Funcional) rodam
/// antes de qualquer carga; num banco vazio elas não encontram os
/// exercícios e não mudam nada. Aqui, no deploy e depois das migrations:
/// faltando exercício curado, carrega o arquivo curado inteiro e reaplica
/// os `UPDATE "exercises"` dessas migrations, em ordem — o mesmo histórico
/// dos bancos onde o catálogo veio antes das migrations (homologação).
/// Os UPDATEs gravam valores fixos ou só preenchem o que está vazio.
/// Tudo numa transação: uma falha não deixa o catálogo pela metade.
/// Num banco que já tem o catálogo completo, não faz nada.

/// Comandos `UPDATE "exercises"` de uma migration, inclusive os com
/// `WITH … AS (VALUES …)` antes. O comando termina com `;` no fim da
/// linha; textos com `;` no meio da linha não cortam o comando.
export function exerciseUpdateStatements(sql: string): string[] {
  const statements: string[] = [];
  let current: string[] | null = null;
  for (const line of sql.split("\n")) {
    if (current === null && /^(UPDATE "exercises"|WITH\b)/.test(line)) current = [];
    if (current === null) continue;
    current.push(line);
    if (/;\s*$/.test(line)) {
      const statement = current.join("\n");
      if (/^UPDATE "exercises"/m.test(statement)) statements.push(statement);
      current = null;
    }
  }
  return statements;
}

export interface EnsureCatalogResult {
  created: number;
  replayed: number;
}

export async function ensureCuratedCatalog(input: { records: CuratedExerciseRecord[]; migrations: { name: string; sql: string }[] }, client: PrismaClient): Promise<EnsureCatalogResult> {
  const existing = new Set(
    (await client.exercise.findMany({ where: { origin: "FITOS_CURATED", tenantId: null }, select: { externalId: true } })).map((row) => row.externalId)
  );
  if (input.records.every((record) => existing.has(record.externalId))) return { created: 0, replayed: 0 };
  const statements = [...input.migrations].sort((a, b) => a.name.localeCompare(b.name)).flatMap((migration) => exerciseUpdateStatements(migration.sql));
  return client.$transaction(
    async (tx) => {
      // `upsert` (nunca "criar e, se já existe, atualizar"): numa transação,
      // um INSERT recusado invalidaria o resto.
      let created = 0;
      for (const record of input.records) {
        const data = curatedExerciseData(record);
        if (!existing.has(record.externalId)) created += 1;
        await tx.exercise.upsert({
          where: { origin_externalId: { origin: "FITOS_CURATED", externalId: record.externalId } },
          create: { ...data, tenantId: null, origin: "FITOS_CURATED", externalId: record.externalId, searchText: exerciseSearchText({ name: record.name, muscle: record.muscle }) },
          update: data,
        });
      }
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      return { created, replayed: statements.length };
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}
