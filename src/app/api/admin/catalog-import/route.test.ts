import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCatalogImportDryRun = vi.fn();
const runCatalogImport = vi.fn();
const parseCuratedCatalogCsv = vi.fn();
const importCuratedCatalog = vi.fn();
const readFile = vi.fn();

vi.mock("@/modules/exercises/catalogImportOrchestrator", () => ({
  runCatalogImportDryRun: (...args: unknown[]) => runCatalogImportDryRun(...args),
  runCatalogImport: (...args: unknown[]) => runCatalogImport(...args),
}));

vi.mock("@/modules/exercises/importCuratedCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/importCuratedCatalog")>(
    "@/modules/exercises/importCuratedCatalog"
  );
  return {
    ...actual,
    parseCuratedCatalogCsv: (...args: unknown[]) => parseCuratedCatalogCsv(...args),
    importCuratedCatalog: (...args: unknown[]) => importCuratedCatalog(...args),
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: (...args: unknown[]) => readFile(...args) };
});

const SECRET = "segredo-de-teste-bem-longo-0123456789";

function postRequest(body: unknown, headers: Record<string, string> = { "x-import-trigger-secret": SECRET }): Request {
  return new Request("http://localhost/api/admin/catalog-import", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(query: Record<string, string>, headers: Record<string, string> = { "x-import-trigger-secret": SECRET }): Request {
  const url = new URL("http://localhost/api/admin/catalog-import");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new Request(url, { method: "GET", headers });
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
});

describe("GET /api/admin/catalog-import (exceção adicional, 21/09/2026 — ferramenta do Product Owner não enviava POST)", () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_TRIGGER_SECRET = SECRET;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  });

  it("retorna 404 sem CATALOG_IMPORT_TRIGGER_SECRET configurada", async () => {
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "homologacao", dryRun: "true" }));

    expect(response.status).toBe(404);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o header do segredo está ausente ou errado", async () => {
    const { GET } = await import("./route");

    expect((await GET(getRequest({ environment: "homologacao", dryRun: "true" }, {}))).status).toBe(404);
    expect(
      (await GET(getRequest({ environment: "homologacao", dryRun: "true" }, { "x-import-trigger-secret": "errado" }))).status
    ).toBe(404);
  });

  it("retorna 400 em environment inválido, sem chamar a orquestração", async () => {
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "outro" }));

    expect(response.status).toBe(400);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("dry-run via query string: chama runCatalogImportDryRun e devolve o relatório", async () => {
    runCatalogImportDryRun.mockResolvedValue({ manifestVersion: "v1", queries: 10, received: 5, valid: 5, failedSearches: 0 });
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "homologacao", dryRun: "true" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, dryRun: true, manifestVersion: "v1", queries: 10, received: 5, valid: 5, failedSearches: 0 });
  });

  it("carga real via query string: exige autorizadoPor, chama runCatalogImport com os dados corretos", async () => {
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
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "homologacao", autorizadoPor: "Murilo Almeida" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(runCatalogImport).toHaveBeenCalledWith({
      environment: "HOMOLOGACAO",
      autorizadoPor: "Murilo Almeida",
      forceReimportNote: undefined,
    });
  });

  it("producao exige autorizarProducao=true na query string", async () => {
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "producao", autorizadoPor: "Murilo Almeida" }));

    expect(response.status).toBe(400);
    expect(runCatalogImport).not.toHaveBeenCalled();
  });
});

describe("Segredo via query string ?secret= (exceção adicional, 21/09/2026 — ferramenta sem controle de header)", () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_TRIGGER_SECRET = SECRET;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  });

  it("aceita o segredo certo via ?secret=, sem nenhum header", async () => {
    runCatalogImportDryRun.mockResolvedValue({ manifestVersion: "v1", queries: 10, received: 0, valid: 0, failedSearches: 0 });
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "homologacao", dryRun: "true", secret: SECRET }, {}));

    expect(response.status).toBe(200);
  });

  it("retorna 404 quando ?secret= está errado, mesmo sem header", async () => {
    const { GET } = await import("./route");

    const response = await GET(getRequest({ environment: "homologacao", dryRun: "true", secret: "errado" }, {}));

    expect(response.status).toBe(404);
    expect(runCatalogImportDryRun).not.toHaveBeenCalled();
  });

  it("também funciona em POST com ?secret= na URL, sem header", async () => {
    runCatalogImportDryRun.mockResolvedValue({ manifestVersion: "v1", queries: 10, received: 0, valid: 0, failedSearches: 0 });
    const { POST } = await import("./route");

    const url = new URL("http://localhost/api/admin/catalog-import");
    url.searchParams.set("secret", SECRET);
    const response = await POST(new Request(url, { method: "POST", body: JSON.stringify({ environment: "homologacao", dryRun: true }) }));

    expect(response.status).toBe(200);
  });
});

describe("GET /api/admin/catalog-import?source=curated (extensão IMP-EX-002, 22/09/2026 — sem acesso a terminal/CLI)", () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_TRIGGER_SECRET = SECRET;
    readFile.mockResolvedValue("canonical_key,name\nfitos:x,X");
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  });

  it("retorna 404 sem o segredo, mesmo com source=curated", async () => {
    const { GET } = await import("./route");

    const response = await GET(getRequest({ source: "curated" }, {}));

    expect(response.status).toBe(404);
    expect(importCuratedCatalog).not.toHaveBeenCalled();
  });

  it("lê o CSV, faz o parsing e importa — devolve o resultado com source: curated", async () => {
    const records = [{ externalId: "fitos:x", name: "X" }];
    parseCuratedCatalogCsv.mockReturnValue(records);
    importCuratedCatalog.mockResolvedValue({ total: 1, created: 1, updated: 0 });
    const { GET } = await import("./route");

    const response = await GET(getRequest({ source: "curated" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, source: "curated", total: 1, created: 1, updated: 0 });
    expect(importCuratedCatalog).toHaveBeenCalledWith(records);
    expect(runCatalogImport).not.toHaveBeenCalled();
  });

  it("linha inválida do CSV (CuratedCatalogRowError) retorna 400", async () => {
    const { CuratedCatalogRowError } = await vi.importActual<typeof import("@/modules/exercises/importCuratedCatalog")>(
      "@/modules/exercises/importCuratedCatalog"
    );
    parseCuratedCatalogCsv.mockImplementation(() => {
      throw new CuratedCatalogRowError(2, 'campo obrigatório "name" ausente ou vazio.');
    });
    const { GET } = await import("./route");

    const response = await GET(getRequest({ source: "curated" }));

    expect(response.status).toBe(400);
    expect(importCuratedCatalog).not.toHaveBeenCalled();
  });

  it("erro inesperado retorna 500 genérico, sem vazar a mensagem original", async () => {
    parseCuratedCatalogCsv.mockReturnValue([]);
    importCuratedCatalog.mockRejectedValue(new Error("detalhe interno sensível"));
    const { GET } = await import("./route");

    const response = await GET(getRequest({ source: "curated" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain("detalhe interno sensível");
  });

  it("também funciona via POST com source: curated no corpo", async () => {
    parseCuratedCatalogCsv.mockReturnValue([]);
    importCuratedCatalog.mockResolvedValue({ total: 0, created: 0, updated: 0 });
    const { POST } = await import("./route");

    const response = await POST(postRequest({ source: "curated" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, source: "curated", total: 0, created: 0, updated: 0 });
  });
});

describe("PUT/PATCH/DELETE (nunca disponíveis, mesmo com o segredo certo)", () => {
  beforeEach(() => {
    process.env.CATALOG_IMPORT_TRIGGER_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.CATALOG_IMPORT_TRIGGER_SECRET;
  });

  it("PUT/PATCH/DELETE sempre respondem 404, mesmo endpoint configurado", async () => {
    const { PUT, PATCH, DELETE } = await import("./route");

    expect((await PUT()).status).toBe(404);
    expect((await PATCH()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
  });
});
