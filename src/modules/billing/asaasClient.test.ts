import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AsaasApiError,
  asaasRequest,
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasSubscription,
  findAsaasCustomerByCpfCnpj,
  listAsaasCustomers,
  updateAsaasSubscription,
} from "./asaasClient";

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

describe("findAsaasCustomerByCpfCnpj", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna o primeiro cliente encontrado pelo CPF/CNPJ", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        object: "list",
        hasMore: false,
        totalCount: 1,
        limit: 10,
        offset: 0,
        data: [{ id: "cus_1", name: "Fulano", cpfCnpj: "11144477735" }],
      })
    );

    const result = await findAsaasCustomerByCpfCnpj({ apiKey: FAKE_KEY, fetchImpl }, "11144477735");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers?cpfCnpj=11144477735",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual({ id: "cus_1", name: "Fulano", cpfCnpj: "11144477735" });
  });

  it("retorna null quando nenhum cliente é encontrado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { object: "list", hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] })
    );

    const result = await findAsaasCustomerByCpfCnpj({ apiKey: FAKE_KEY, fetchImpl }, "11144477735");

    expect(result).toBeNull();
  });
});

describe("createAsaasCustomer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz POST /customers com o corpo informado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "cus_1", name: "Fulano", cpfCnpj: "11144477735" }));

    const result = await createAsaasCustomer(
      { apiKey: FAKE_KEY, fetchImpl },
      { name: "Fulano", cpfCnpj: "11144477735", externalReference: "tenant-1" }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Fulano", cpfCnpj: "11144477735", externalReference: "tenant-1" }),
      })
    );
    expect(result.id).toBe("cus_1");
  });
});

describe("createAsaasSubscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz POST /subscriptions com o corpo informado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "sub_1", customer: "cus_1", status: "ACTIVE" }));

    const result = await createAsaasSubscription(
      { apiKey: FAKE_KEY, fetchImpl },
      { customer: "cus_1", billingType: "UNDEFINED", value: 49.9, cycle: "MONTHLY", nextDueDate: "2026-10-28" }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ customer: "cus_1", billingType: "UNDEFINED", value: 49.9, cycle: "MONTHLY", nextDueDate: "2026-10-28" }),
      })
    );
    expect(result.id).toBe("sub_1");
  });
});

describe("updateAsaasSubscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz PUT /subscriptions/{id} sem nunca incluir nextDueDate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "sub_1", customer: "cus_1", status: "ACTIVE" }));

    await updateAsaasSubscription({ apiKey: FAKE_KEY, fetchImpl }, "sub_1", { value: 69.9, cycle: "MONTHLY" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions/sub_1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ value: 69.9, cycle: "MONTHLY" }) })
    );
  });
});

describe("cancelAsaasSubscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("faz DELETE /subscriptions/{id}", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { deleted: true }));

    await cancelAsaasSubscription({ apiKey: FAKE_KEY, fetchImpl }, "sub_1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions/sub_1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
