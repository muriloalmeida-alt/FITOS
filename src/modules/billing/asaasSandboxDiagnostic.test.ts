import { afterEach, describe, expect, it, vi } from "vitest";
import { runAsaasSandboxDiagnostic } from "./asaasSandboxDiagnostic";

const FAKE_KEY = "$aact_sandbox_fake_key_never_real_1234567890";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("runAsaasSandboxDiagnostic (FIT-128, diagnóstico temporário)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("nunca chama a rede fora do ambiente de homologação", async () => {
    const fetchImpl = vi.fn();
    await runAsaasSandboxDiagnostic({ appEnv: "development", apiKey: FAKE_KEY, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("nunca chama a rede em homologação sem a variável API_ASAAS configurada", async () => {
    const fetchImpl = vi.fn();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: undefined, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("API_ASAAS não configurada"));
  });

  it("sucesso: loga status, duração e formato de listagem — nunca a chave", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { object: "list", hasMore: false, totalCount: 0, limit: 1, offset: 0, data: [] })
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers?limit=1",
      expect.objectContaining({
        method: "GET",
        headers: { access_token: FAKE_KEY, "User-Agent": "FitOS/1.0" },
      })
    );
    const loggedText = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("sucesso");
    expect(loggedText).toContain("status=200");
    expect(loggedText).toContain("formatoDeListagem=true");
    expect(loggedText).not.toContain(FAKE_KEY);
  });

  it("resposta que não tem formato de listagem é reportada como tal, sem falhar", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl });

    const loggedText = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("formatoDeListagem=false");
  });

  it("erro 401: loga só código/descrição saneados do Asaas — nunca a chave nem o corpo inteiro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(401, { errors: [{ code: "invalid_access_token", description: "O access_token informado é inválido." }] })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl });

    const loggedText = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("status=401");
    expect(loggedText).toContain("invalid_access_token");
    expect(loggedText).toContain("O access_token informado é inválido.");
    expect(loggedText).not.toContain(FAKE_KEY);
  });

  it("erro de rede (ex.: DNS): loga só a categoria, nunca a mensagem/stack completa", async () => {
    const dnsError = new Error("getaddrinfo ENOTFOUND api-sandbox.asaas.com");
    (dnsError as Error & { cause?: unknown }).cause = { code: "ENOTFOUND" };
    const fetchImpl = vi.fn().mockRejectedValue(dnsError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl });

    const loggedText = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("erro de rede");
    expect(loggedText).toContain("dns:ENOTFOUND");
    expect(loggedText).not.toContain(FAKE_KEY);
  });

  it("timeout (AbortError): loga a categoria \"timeout\"", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl });

    const loggedText = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("categoria=timeout");
  });

  it("nunca lança — mesmo com corpo de resposta que não é JSON válido", async () => {
    const notJsonResponse = new Response("<html>não é json</html>", { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(notJsonResponse);

    await expect(
      runAsaasSandboxDiagnostic({ appEnv: "homologacao", apiKey: FAKE_KEY, fetchImpl })
    ).resolves.toBeUndefined();
  });
});
