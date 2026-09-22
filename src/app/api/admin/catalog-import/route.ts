import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { secretsMatch } from "@/shared/lib/secretCompare";
import { parseCatalogImportRequest, CatalogImportRequestValidationError } from "@/modules/exercises/catalogImportRequest";
import { runCatalogImport, runCatalogImportDryRun } from "@/modules/exercises/catalogImportOrchestrator";
import {
  CatalogImportAlreadyCompletedError,
  CatalogImportLockedError,
  CatalogImportManifestMismatchError,
} from "@/modules/exercises/catalogImportRun";
import { CuratedCatalogRowError, importCuratedCatalog, parseCuratedCatalogCsv } from "@/modules/exercises/importCuratedCatalog";

/// Exceção de governança registrada (IMP-EX-001, pacote pós-MVP proíbe
/// explicitamente "endpoint público para disparar a importação") — decisão
/// tomada por Murilo em 21/09/2026 porque o acesso SSH/CLI ao Railway não
/// estava funcionando no momento. Ver
/// `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`, seção
/// "Exceção — rota HTTP interna", para o registro completo da decisão, do
/// risco aceito (inclusive os riscos adicionais do método `GET` e do
/// segredo por query string, ambos aceitos separadamente em 21/09/2026) e
/// do plano de retirada.
///
/// Estendida em 22/09/2026 (IMP-EX-002) para também disparar a importação
/// do catálogo curado (`?source=curated`), pelo mesmo motivo e mesma
/// decisão explícita de Murilo: sem acesso a terminal/CLI em homologação.
/// Mesmo segredo, mesma superfície — ver `runCuratedCatalogImport` abaixo.
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

/// Aceita o segredo pelo header `X-Import-Trigger-Secret` (preferível — não
/// fica em log de acesso) OU pelo parâmetro de query `secret` (exceção
/// adicional aceita por Murilo em 21/09/2026, para uma ferramenta de
/// disparo — navegador/app/webhook — sem controle de header). Usar a query
/// string trata o valor de `CATALOG_IMPORT_TRIGGER_SECRET` como
/// permanentemente exposto (log de acesso do Next.js/Railway/qualquer
/// proxy no caminho, histórico de navegador, `Referer`) — ver
/// `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md` para o risco
/// completo e a instrução de rotacionar o segredo após o uso por URL.
function isAuthorized(request: Request): boolean {
  const expected = process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  if (!expected) {
    return false;
  }
  const header = request.headers.get("x-import-trigger-secret");
  if (header && secretsMatch(header, expected)) {
    return true;
  }
  const queryValue = new URL(request.url).searchParams.get("secret");
  if (queryValue && secretsMatch(queryValue, expected)) {
    return true;
  }
  return false;
}

function readBoolean(value: string | null): boolean {
  return value === "true" || value === "1";
}

const CURATED_CATALOG_CSV_PATH = path.join(process.cwd(), "src/modules/exercises/data/catalogo-exercicios-fitos-ptbr.csv");

/// Extensão desta mesma exceção de governança (IMP-EX-002, 22/09/2026):
/// Murilo não tem acesso a terminal/CLI para rodar
/// `npm run catalog:import-curated` em homologação — `?source=curated`
/// dispara a importação do catálogo curado em vez da API Ninjas, pelo
/// mesmo segredo e mesmo guarda-corpo de `isAuthorized`. Sem parâmetros de
/// `environment`/`autorizadoPor`: a importação curada é sempre idempotente
/// (upsert por `externalId`, ver `importCuratedCatalog.ts`) e lê sempre o
/// mesmo arquivo versionado no repositório — nenhuma trava adicional é
/// necessária, ao contrário da API Ninjas.
async function runCuratedCatalogImport(): Promise<Response> {
  try {
    const csvContent = await readFile(CURATED_CATALOG_CSV_PATH, "utf-8");
    const records = parseCuratedCatalogCsv(csvContent);
    const result = await importCuratedCatalog(records);
    return Response.json({ ok: true, source: "curated", ...result });
  } catch (error) {
    if (error instanceof CuratedCatalogRowError) {
      return Response.json({ ok: false, error: "VALIDACAO", message: error.message }, { status: 400 });
    }
    console.error("[api/admin/catalog-import] falha na importação curada:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "ERRO_INTERNO" }, { status: 500 });
  }
}

/// `GET` e `POST` chegam aqui já normalizados para o mesmo formato — única
/// implementação de despacho, nunca duplicada entre os dois métodos.
async function handle(request: Request, input: Record<string, unknown>): Promise<Response> {
  if (!isAuthorized(request)) {
    return notFound();
  }

  if (input.source === "curated") {
    return runCuratedCatalogImport();
  }

  let parsed;
  try {
    parsed = parseCatalogImportRequest({
      environment: input.environment,
      dryRun: Boolean(input.dryRun),
      autorizadoPor: input.autorizadoPor,
      forceReimport: Boolean(input.forceReimport),
      justificativa: input.justificativa,
      autorizarProducao: Boolean(input.autorizarProducao),
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

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return notFound();
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "VALIDACAO", message: "Corpo da requisição deve ser um objeto JSON." }, { status: 400 });
  }
  return handle(request, body as Record<string, unknown>);
}

/// Adicionado em 21/09/2026 como exceção adicional, explícita e informada:
/// além de já não ser um endpoint público (ver guarda-corpos acima), aceitar
/// `GET` reintroduz um risco próprio que `POST`-only evitava — navegadores,
/// proxies e CDNs podem pré-carregar/cachear uma URL `GET`, e ferramentas
/// HTTP costumam repetir automaticamente uma `GET` que falhou por rede, o
/// que poderia acionar a carga sem intenção. Murilo decidiu aceitar esse
/// risco porque a ferramenta disponível para chamar a rota não conseguia
/// enviar `POST`. Ver `isAuthorized` para a forma de autenticação (header
/// preferível; `?secret=` aceito como exceção adicional). A mesma trava de
/// `CatalogImportRun` protege contra qualquer disparo repetido.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return notFound();
  }
  const params = new URL(request.url).searchParams;
  return handle(request, {
    source: params.get("source"),
    environment: params.get("environment"),
    dryRun: readBoolean(params.get("dryRun")),
    autorizadoPor: params.get("autorizadoPor"),
    forceReimport: readBoolean(params.get("forceReimport")),
    justificativa: params.get("justificativa"),
    autorizarProducao: readBoolean(params.get("autorizarProducao")),
  });
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
