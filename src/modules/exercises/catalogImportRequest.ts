import type { CatalogImportEnvironmentInput } from "./catalogImportRun";

/// Validação compartilhada entre o comando administrativo
/// (`scripts/import-exercicios.ts`) e a rota HTTP interna
/// (`src/app/api/admin/catalog-import/route.ts`, exceção registrada —
/// ver `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`) — as duas
/// entradas da carga do catálogo aplicam exatamente as mesmas regras, nunca
/// duplicadas/divergentes.

export interface CatalogImportRequestInput {
  environment: unknown;
  dryRun: boolean;
  autorizadoPor?: unknown;
  forceReimport: boolean;
  justificativa?: unknown;
  autorizarProducao: boolean;
}

export interface CatalogImportRequest {
  environment: CatalogImportEnvironmentInput;
  dryRun: boolean;
  autorizadoPor?: string;
  forceReimportNote?: string;
}

export class CatalogImportRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogImportRequestValidationError";
  }
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CatalogImportRequestValidationError(message);
  }
  return value.trim();
}

export function parseCatalogImportRequest(input: CatalogImportRequestInput): CatalogImportRequest {
  if (input.environment !== "homologacao" && input.environment !== "producao") {
    throw new CatalogImportRequestValidationError('environment deve ser "homologacao" ou "producao".');
  }
  const environment: CatalogImportEnvironmentInput = input.environment === "homologacao" ? "HOMOLOGACAO" : "PRODUCAO";

  if (input.dryRun) {
    return { environment, dryRun: true };
  }

  const autorizadoPor = requireString(input.autorizadoPor, "autorizadoPor é obrigatório fora de dryRun.");

  if (environment === "PRODUCAO" && !input.autorizarProducao) {
    throw new CatalogImportRequestValidationError("producao exige autorizarProducao=true explicitamente, além de autorizadoPor.");
  }

  let forceReimportNote: string | undefined;
  if (input.forceReimport) {
    forceReimportNote = requireString(input.justificativa, "forceReimport exige justificativa.");
  }

  return { environment, dryRun: false, autorizadoPor, forceReimportNote };
}
