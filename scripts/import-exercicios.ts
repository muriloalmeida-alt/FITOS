/**
 * IMP-EX-001 — comando administrativo da carga única do catálogo global a
 * partir da API Ninjas. Execução manual apenas — nunca chamado pelo build,
 * seed, deploy ou acesso à página.
 *
 * Uso:
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --dry-run
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --autorizado-por="Nome Sobrenome"
 *   npm run catalog:import-api-ninjas -- --environment=producao --autorizado-por="Nome Sobrenome" --autorizar-producao
 *   npm run catalog:import-api-ninjas -- --environment=homologacao --autorizado-por="Nome Sobrenome" --force-reimport --justificativa="motivo auditado"
 *
 * Sem `API_NINJAS_API_KEY` configurada, encerra imediatamente sem nenhuma
 * chamada de rede ou escrita no banco (mesmo comportamento desde a FIT-021).
 *
 * Reexecutar o mesmo comando após uma falha (`FAILED`) retoma automaticamente
 * a partir do checkpoint salvo — não existe flag separada de retomada.
 * Reexecutar após sucesso (`COMPLETED`) é recusado, a menos que
 * `--force-reimport` e `--justificativa` sejam informados (reimportação
 * excepcional autorizada por Produto, IMP-EX-001 critério 5).
 *
 * A mesma orquestração (`catalogImportOrchestrator.ts`) também é usada pela
 * rota HTTP interna `src/app/api/admin/catalog-import/route.ts` — exceção
 * de governança registrada em `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`
 * para quando este comando não pode ser executado por falta de acesso SSH/CLI ao Railway.
 */
import { PrismaClient } from "@prisma/client";
import { parseCatalogImportRequest, CatalogImportRequestValidationError } from "../src/modules/exercises/catalogImportRequest";
import { runCatalogImport, runCatalogImportDryRun } from "../src/modules/exercises/catalogImportOrchestrator";

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (const raw of argv) {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    if (!key) {
      continue;
    }
    flags[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return flags;
}

async function main(): Promise<void> {
  if (!process.env.API_NINJAS_API_KEY) {
    console.log(
      "[catalog:import-api-ninjas] API_NINJAS_API_KEY não está configurada — importação indisponível. " +
        "Nenhuma chamada de rede ou escrita no banco foi feita."
    );
    return;
  }

  const flags = parseArgv(process.argv.slice(2));
  let parsed;
  try {
    parsed = parseCatalogImportRequest({
      environment: flags.environment,
      dryRun: Boolean(flags["dry-run"]),
      autorizadoPor: flags["autorizado-por"],
      forceReimport: Boolean(flags["force-reimport"]),
      justificativa: flags.justificativa,
      autorizarProducao: Boolean(flags["autorizar-producao"]),
    });
  } catch (error) {
    if (error instanceof CatalogImportRequestValidationError) {
      console.error(`[catalog:import-api-ninjas] ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (parsed.dryRun) {
    console.log(`[catalog:import-api-ninjas] dry-run — validando credencial/contrato/volume, sem gravar nada.`);
    const report = await runCatalogImportDryRun();
    console.log("[catalog:import-api-ninjas] resultado do dry-run:", JSON.stringify(report));
    return;
  }

  console.log(`[catalog:import-api-ninjas] ambiente=${parsed.environment} autorizado-por="${parsed.autorizadoPor}"`);

  const prisma = new PrismaClient();
  try {
    const summary = await runCatalogImport(
      { environment: parsed.environment, autorizadoPor: parsed.autorizadoPor!, forceReimportNote: parsed.forceReimportNote },
      prisma
    );
    if (summary.resumedFromCheckpoint > 0) {
      console.log(`[catalog:import-api-ninjas] retomado a partir da consulta ${summary.resumedFromCheckpoint}.`);
    }
    console.log("[catalog:import-api-ninjas] concluído:", JSON.stringify(summary));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[catalog:import-api-ninjas] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
