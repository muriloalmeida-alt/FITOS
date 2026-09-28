import { afterEach, describe, expect, it, vi } from "vitest";
import { AsaasApiError, asaasRequest, listAsaasCustomers } from "./asaasClient";

const FAKE_KEY = "$aact_sandbox_fake_key_never_real_1234567890";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

async function captureAsaasApiError(promise: Promise<unknown>): Promise<AsaasApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AsaasApiError) {
      return error;
    }
    throw error;
  }
  throw new Error("esperava que a promise rejeitasse com AsaasApiError");
}

describe("asaasRequest (cliente HTTP real do Asaas, FIT-128)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("autentica com access_token/User-Agent e usa a base URL do Sandbox por padrão", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));

    await asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1", { method: "GET" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers?limit=1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ access_token: FAKE_KEY, "User-Agent": "FitOS/1.0" }),
      })
    );
  });

  it("retorna o corpo desserializado em sucesso", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { object: "list", data: [] }));

    const result = await asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1");

    expect(result).toEqual({ object: "list", data: [] });
  });

  it("erro HTTP: lança AsaasApiError com status/código/descrição saneados — nunca a chave nem o corpo inteiro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(401, { errors: [{ code: "invalid_access_token", description: "O access_token informado é inválido." }] })
    );

    const error = await captureAsaasApiError(asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1"));

    expect(error).toBeInstanceOf(AsaasApiError);
    expect(error.kind).toBe("resposta_de_erro");
    expect(error.status).toBe(401);
    expect(error.codigo).toBe("invalid_access_token");
    expect(error.message).toBe("O access_token informado é inválido.");
    expect(error.message).not.toContain(FAKE_KEY);
    expect(JSON.stringify(error)).not.toContain(FAKE_KEY);
  });

  it("erro de rede (ex.: DNS): lança AsaasApiError com categoria, nunca a mensagem/stack completa", async () => {
    const dnsError = new Error("getaddrinfo ENOTFOUND api-sandbox.asaas.com");
    (dnsError as Error & { cause?: unknown }).cause = { code: "ENOTFOUND" };
    const fetchImpl = vi.fn().mockRejectedValue(dnsError);

    const error = await captureAsaasApiError(asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1"));

    expect(error).toBeInstanceOf(AsaasApiError);
    expect(error.kind).toBe("erro_de_rede");
    expect(error.message).toBe("dns:ENOTFOUND");
  });

  it("timeout (AbortError): categoria \"timeout\"", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    const error = await captureAsaasApiError(asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1"));

    expect(error).toBeInstanceOf(AsaasApiError);
    expect(error.message).toBe("timeout");
  });

  it("resposta sem JSON válido nunca lança erro não tratado", async () => {
    const notJsonResponse = new Response("<html>não é json</html>", { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(notJsonResponse);

    await expect(asaasRequest({ apiKey: FAKE_KEY, fetchImpl }, "/customers?limit=1")).resolves.toBeNull();
  });

  it("aceita uma base URL customizada (nunca produção por padrão)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));

    await asaasRequest({ apiKey: FAKE_KEY, fetchImpl, baseUrl: "https://exemplo.invalido/v3" }, "/ping");

    expect(fetchImpl).toHaveBeenCalledWith("https://exemplo.invalido/v3/ping", expect.anything());
  });
});

describe("listAsaasCustomers (única chamada provada contra o Asaas real)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz GET /customers?limit=1 por padrão", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { object: "list", hasMore: false, totalCount: 0, limit: 1, offset: 0, data: [] })
    );

    const result = await listAsaasCustomers({ apiKey: FAKE_KEY, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers?limit=1",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.object).toBe("list");
  });

  it("respeita um limit customizado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { object: "list", hasMore: false, totalCount: 0, limit: 5, offset: 0, data: [] })
    );

    await listAsaasCustomers({ apiKey: FAKE_KEY, fetchImpl }, { limit: 5 });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers?limit=5",
      expect.anything()
    );
  });
});
