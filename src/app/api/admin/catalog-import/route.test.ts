import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCatalogImportDryRun = vi.fn();
const runCatalogImport = vi.fn();

vi.mock("@/modules/exercises/catalogImportOrchestrator", () => ({
  runCatalogImportDryRun: (...args: unknown[]) => runCatalogImportDryRun(...args),
  runCatalogImport: (...args: unknown[]) => runCatalogImport(...args),
}));

const SECRET = "segredo-de-teste-bem-longo-0123456789";

function postRequest(body: unknown, headers: Record<string, string> = { "x-import-trigger-secret": SECRET }): Request {
  return new Request("http://localhost/api/admin/catalog-import", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/catalog-import (IMP-EX-001, exceção de governança)", () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_TRIGGER_SECRET = SECRET;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  });

  it("retorna 404 sem CATALOG_IMPORT_TRIGGER_SECRET configurada — mesmo com o segredo certo no header", async () => {
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", dryRun: true }));

    expect(response.status).toBe(404);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o header do segredo está ausente", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", dryRun: true }, {}));

    expect(response.status).toBe(404);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o segredo do header está errado", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", dryRun: true }, { "x-import-trigger-secret": "errado" }));

    expect(response.status).toBe(404);
  });

  it("retorna 400 em environment inválido, sem chamar a orquestração", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "outro", dryRun: true }));

    expect(response.status).toBe(400);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("dry-run: chama runCatalogImportDryRun e devolve o relatório", async () => {
    runCatalogImportDryRun.mockResolvedValue({ manifestVersion: "v1", queries: 10, received: 5, valid: 5, failedSearches: 0 });
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", dryRun: true }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, dryRun: true, manifestVersion: "v1", queries: 10, received: 5, valid: 5, failedSearches: 0 });
    expect(runCatalogImport).not.toHaveBeenCalled();
  });

  it("carga real: exige autorizadoPor, chama runCatalogImport com os dados corretos", async () => {
    runCatalogImport.mockResolvedValue({
      runId: "run-1",
      environment: "HOMOLOGACAO",
      resumedFromCheckpoint: 0,
      received: 10,
      inserted: 10,
      updated: 0,
      ignored: 0,
      errors: 0,
    });
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", autorizadoPor: "Murilo Almeida" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(runCatalogImport).toHaveBeenCalledWith({
      environment: "HOMOLOGACAO",
      autorizadoPor: "Murilo Almeida",
      forceReimportNote: undefined,
    });
  });

  it("traduz erro de trava/segunda carga para 409, sem vazar detalhe interno", async () => {
    const { CatalogImportAlreadyCompletedError } = await vi.importActual<typeof import("@/modules/exercises/catalogImportRun")>(
      "@/modules/exercises/catalogImportRun"
    );
    runCatalogImport.mockRejectedValue(new CatalogImportAlreadyCompletedError("HOMOLOGACAO"));
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", autorizadoPor: "Murilo Almeida" }));

    expect(response.status).toBe(409);
  });

  it("erro inesperado retorna 500 genérico, sem vazar a mensagem original", async () => {
    runCatalogImport.mockRejectedValue(new Error("detalhe interno sensível"));
    const { POST } = await import("./route");

    const response = await POST(postRequest({ environment: "homologacao", autorizadoPor: "Murilo Almeida" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain("detalhe interno sensível");
  });

  it("GET/PUT/PATCH/DELETE sempre respondem 404, mesmo endpoint configurado", async () => {
    const { GET, PUT, PATCH, DELETE } = await import("./route");

    expect((await GET()).status).toBe(404);
    expect((await PUT()).status).toBe(404);
    expect((await PATCH()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
  });
});
