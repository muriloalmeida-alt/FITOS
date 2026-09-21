import "server-only";
import { Prisma, type CatalogImportRun, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// IMP-EX-001: ciclo de vida da carga única do catálogo. Nenhuma função
/// deste módulo é chamada por build, seed, deploy ou acesso de página — só
/// por `scripts/import-exercicios.ts` (execução manual/administrativa).

export type CatalogImportEnvironmentInput = "HOMOLOGACAO" | "PRODUCAO";

export class CatalogImportLockedError extends Error {
  constructor(environment: CatalogImportEnvironmentInput) {
    super(
      `Já existe uma importação em andamento (status RUNNING) para o ambiente ${environment}. ` +
        "Aguarde a conclusão ou a falha dessa execução antes de iniciar outra."
    );
    this.name = "CatalogImportLockedError";
  }
}

export class CatalogImportAlreadyCompletedError extends Error {
  constructor(environment: CatalogImportEnvironmentInput) {
    super(
      `A importação do catálogo já foi concluída (status COMPLETED) para o ambiente ${environment}. ` +
        "Reimportação exige autorização de Produto e justificativa (--force-reimport com --justificativa e --autorizado-por)."
    );
    this.name = "CatalogImportAlreadyCompletedError";
  }
}

export class CatalogImportManifestMismatchError extends Error {
  constructor() {
    super(
      "Existe uma execução FAILED anterior para este ambiente com um manifesto de consultas diferente do atual. " +
        "Retomar continuaria de um checkpoint que não corresponde às consultas de hoje — inicie uma nova execução " +
        "(ou restaure o manifesto original) em vez de retomar esta."
    );
    this.name = "CatalogImportManifestMismatchError";
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export interface StartCatalogImportRunInput {
  environment: CatalogImportEnvironmentInput;
  importerVersion: string;
  manifestHash: string;
  executor: string;
  forceReimportNote?: string;
}

/// Inicia ou retoma uma execução. Regras (IMP-EX-001, seção 5):
/// 1. `RUNNING` existente para o par (provider, environment) → bloqueia.
/// 2. `COMPLETED` existente → bloqueia, a menos que `forceReimportNote`
///    tenha sido informado (reimportação explicitamente autorizada).
/// 3. `FAILED` existente com o mesmo `manifestHash` → retoma a mesma linha
///    (mantém `checkpoint`/contadores, muda status para `RUNNING`).
/// 4. `FAILED` existente com `manifestHash` diferente → erro explícito
///    (nunca retoma silenciosamente um checkpoint de outro manifesto).
/// 5. Nenhuma linha existente → cria uma nova, status `RUNNING`.
///
/// A checagem acima roda dentro de uma transação, mas a garantia real contra
/// concorrência é o índice único parcial da migration
/// (`catalog_import_runs_running_lock`/`_completed_lock`): se dois processos
/// chegarem simultaneamente, um dos dois `create`/`update` falha com P2002 e
/// é traduzido para o mesmo erro tipado abaixo.
export async function startCatalogImportRun(
  input: StartCatalogImportRunInput,
  client: PrismaClient = prisma
): Promise<CatalogImportRun> {
  const { environment, importerVersion, manifestHash, executor, forceReimportNote } = input;

  try {
    return await client.$transaction(async (tx) => {
      const existing = await tx.catalogImportRun.findFirst({
        where: { provider: "API_NINJAS", environment },
        orderBy: { createdAt: "desc" },
      });

      if (!existing) {
        return tx.catalogImportRun.create({
          data: { environment, status: "RUNNING", importerVersion, manifestHash, executor, startedAt: new Date() },
        });
      }

      if (existing.status === "RUNNING") {
        throw new CatalogImportLockedError(environment);
      }

      if (existing.status === "COMPLETED") {
        if (!forceReimportNote) {
          throw new CatalogImportAlreadyCompletedError(environment);
        }
        return tx.catalogImportRun.create({
          data: {
            environment,
            status: "RUNNING",
            importerVersion,
            manifestHash,
            executor,
            forceReimportNote,
            startedAt: new Date(),
          },
        });
      }

      // existing.status === "FAILED" ou "PENDING": retomar a mesma linha.
      if (existing.manifestHash !== manifestHash) {
        throw new CatalogImportManifestMismatchError();
      }
      return tx.catalogImportRun.update({
        where: { id: existing.id },
        data: { status: "RUNNING", importerVersion, executor, startedAt: existing.startedAt ?? new Date() },
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new CatalogImportLockedError(environment);
    }
    throw error;
  }
}

export interface CatalogImportProgress {
  checkpoint: number;
  received: number;
  inserted: number;
  updated: number;
  ignored: number;
  errors: number;
}

/// Avança o checkpoint e soma os contadores desta consulta ao total já
/// acumulado na linha — chamado uma vez por consulta do manifesto processada
/// (com sucesso ou não), para que uma retomada saiba exatamente de onde
/// continuar mesmo que o processo caia entre duas consultas.
export async function advanceCatalogImportRun(
  runId: string,
  delta: CatalogImportProgress,
  client: PrismaClient = prisma
): Promise<void> {
  await client.catalogImportRun.update({
    where: { id: runId },
    data: {
      checkpoint: delta.checkpoint,
      received: { increment: delta.received },
      inserted: { increment: delta.inserted },
      updated: { increment: delta.updated },
      ignored: { increment: delta.ignored },
      errors: { increment: delta.errors },
    },
  });
}

export async function completeCatalogImportRun(runId: string, client: PrismaClient = prisma): Promise<CatalogImportRun> {
  return client.catalogImportRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
}

export async function failCatalogImportRun(runId: string, client: PrismaClient = prisma): Promise<CatalogImportRun> {
  return client.catalogImportRun.update({
    where: { id: runId },
    data: { status: "FAILED", finishedAt: new Date() },
  });
}
