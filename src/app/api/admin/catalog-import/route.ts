import "server-only";
import { secretsMatch } from "@/shared/lib/secretCompare";
import { parseCatalogImportRequest, CatalogImportRequestValidationError } from "@/modules/exercises/catalogImportRequest";
import { runCatalogImport, runCatalogImportDryRun } from "@/modules/exercises/catalogImportOrchestrator";
import {
  CatalogImportAlreadyCompletedError,
  CatalogImportLockedError,
  CatalogImportManifestMismatchError,
} from "@/modules/exercises/catalogImportRun";

/// Exceção de governança registrada (IMP-EX-001, pacote pós-MVP proíbe
/// explicitamente "endpoint público para disparar a importação") — decisão
/// tomada por Murilo em 21/09/2026 porque o acesso SSH/CLI ao Railway não
/// estava funcionando no momento. Ver
/// `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`, seção
/// "Exceção — rota HTTP interna", para o registro completo da decisão, do
/// risco aceito e do plano de retirada.
///
/// Não é uma rota pública: sem `CATALOG_IMPORT_TRIGGER_SECRET` configurada,
/// comporta-se como se não existisse (404 em qualquer método, nunca 503 —
/// não revela se a variável está ausente ou se o segredo está errado).
/// Nunca linkada em nenhuma navegação/UI da aplicação; só é utilizável por
/// quem tiver o segredo (variável separada de `API_NINJAS_API_KEY` — nunca
/// o mesmo segredo para dois propósitos).
function notFound(): Response {
  return new Response(null, { status: 404 });
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  if (!expected) {
    return false;
  }
  const provided = request.headers.get("x-import-trigger-secret");
  if (!provided) {
    return false;
  }
  return secretsMatch(provided, expected);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return notFound();
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "VALIDACAO", message: "Corpo da requisição deve ser um objeto JSON." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseCatalogImportRequest({
      environment: (body as Record<string, unknown>).environment,
      dryRun: Boolean((body as Record<string, unknown>).dryRun),
      autorizadoPor: (body as Record<string, unknown>).autorizadoPor,
      forceReimport: Boolean((body as Record<string, unknown>).forceReimport),
      justificativa: (body as Record<string, unknown>).justificativa,
      autorizarProducao: Boolean((body as Record<string, unknown>).autorizarProducao),
    });
  } catch (error) {
    if (error instanceof CatalogImportRequestValidationError) {
      return Response.json({ ok: false, error: "VALIDACAO", message: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    if (parsed.dryRun) {
      const report = await runCatalogImportDryRun();
      return Response.json({ ok: true, dryRun: true, ...report });
    }

    const summary = await runCatalogImport({
      environment: parsed.environment,
      autorizadoPor: parsed.autorizadoPor!,
      forceReimportNote: parsed.forceReimportNote,
    });
    return Response.json({ ok: true, dryRun: false, ...summary });
  } catch (error) {
    if (
      error instanceof CatalogImportLockedError ||
      error instanceof CatalogImportAlreadyCompletedError ||
      error instanceof CatalogImportManifestMismatchError
    ) {
      return Response.json({ ok: false, error: error.name, message: error.message }, { status: 409 });
    }
    console.error("[api/admin/catalog-import] falha:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "ERRO_INTERNO" }, { status: 500 });
  }
}

export function GET(): Response {
  return notFound();
}

export function PUT(): Response {
  return notFound();
}

export function PATCH(): Response {
  return notFound();
}

export function DELETE(): Response {
  return notFound();
}
