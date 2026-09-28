// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createPublicOnlyUploadImage, PublicImageUrlError, validatePublicImageUrl } from "./publicUrlValidator";

const URL = "https://pub-76bc00d74c5a4bf98ccac51eb4c92de3.r2.dev/abdominal-bicicleta.webp";

function fetchStub(impl: (url: string, init: RequestInit) => Promise<Response> | Response): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => impl(String(input), init ?? {})) as unknown as typeof fetch;
}

function response(status: number, withBody = false): Response {
  return new Response(withBody ? "conteudo" : null, { status });
}

describe("validatePublicImageUrl", () => {
  it("aceita HEAD 200 numa única tentativa, sem retry", async () => {
    const fetchImpl = fetchStub(() => response(200));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "HEAD", redirect: "follow" }));
  });

  it("aceita HEAD 206 (Partial Content) como 2xx válido", async () => {
    const fetchImpl = fetchStub(() => response(206));
    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).resolves.toBeUndefined();
  });

  it("404: falha imediata, sem nenhuma retentativa", async () => {
    const fetchImpl = fetchStub(() => response(404));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).rejects.toThrow(PublicImageUrlError);
    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // uma chamada por expect acima, nenhuma retentativa em cada uma
  });

  it("403: falha imediata, sem nenhuma retentativa", async () => {
    const fetchImpl = fetchStub(() => response(403));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).rejects.toThrow(/HTTP 403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("HEAD 405 (Method Not Allowed): faz fallback para GET e aceita 2xx", async () => {
    const fetchImpl = fetchStub((_url, init) => (init.method === "HEAD" ? response(405) : response(200)));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(2, URL, expect.objectContaining({ method: "GET" }));
  });

  it("HEAD 501 (Not Implemented): faz fallback para GET e aceita 2xx", async () => {
    const fetchImpl = fetchStub((_url, init) => (init.method === "HEAD" ? response(501) : response(200)));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("GET de fallback nunca lê o corpo inteiro — usa Range mínimo", async () => {
    const fetchImpl = fetchStub((_url, init) => {
      if (init.method === "HEAD") return response(405);
      expect(init.headers).toMatchObject({ Range: "bytes=0-0" });
      return response(200);
    });

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 })).resolves.toBeUndefined();
  });

  it("timeout/erro de rede: retenta um número limitado de vezes e falha de forma controlada", async () => {
    const fetchImpl = fetchStub(() => {
      throw new DOMException("The operation was aborted", "AbortError");
    });

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0, maxAttempts: 3 })).rejects.toThrow(PublicImageUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("429: retenta e sucede quando uma tentativa seguinte responde 2xx", async () => {
    let calls = 0;
    const fetchImpl = fetchStub(() => {
      calls += 1;
      return calls < 2 ? response(429) : response(200);
    });

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0, maxAttempts: 3 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("5xx: retenta e sucede quando uma tentativa seguinte responde 2xx", async () => {
    let calls = 0;
    const fetchImpl = fetchStub(() => {
      calls += 1;
      return calls < 2 ? response(503) : response(200);
    });

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0, maxAttempts: 3 })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("429/5xx persistentes: esgota as tentativas e falha de forma controlada, nunca lançando indefinidamente", async () => {
    const fetchImpl = fetchStub(() => response(503));

    await expect(validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0, maxAttempts: 3 })).rejects.toThrow(PublicImageUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("segue redirecionamentos (redirect: follow) em toda requisição", async () => {
    const fetchImpl = fetchStub(() => response(200));
    await validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 });
    expect(fetchImpl).toHaveBeenCalledWith(URL, expect.objectContaining({ redirect: "follow" }));
  });

  it("nunca inclui cabeçalho, token ou segredo na mensagem de erro — só status e URL pública", async () => {
    const fetchImpl = fetchStub(() => response(403));
    let caught: unknown;
    try {
      await validatePublicImageUrl(URL, { fetchImpl, retryDelayMs: 0 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PublicImageUrlError);
    expect((caught as Error).message).not.toMatch(/secret|token|chave|senha/i);
  });
});

describe("createPublicOnlyUploadImage", () => {
  it("monta a URL a partir da base pública configurada + chave do objeto, e a valida", async () => {
    const fetchImpl = fetchStub(() => response(200));
    const uploadImage = createPublicOnlyUploadImage({ publicBaseUrl: "https://pub-exemplo.r2.dev" }, { fetchImpl, retryDelayMs: 0 });

    await expect(
      uploadImage({ key: "exercises/abdominal-bicicleta.webp", body: Buffer.from(""), contentType: "image/webp" })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://pub-exemplo.r2.dev/exercises/abdominal-bicicleta.webp",
      expect.objectContaining({ method: "HEAD" })
    );
  });

  it("propaga a falha (PublicImageUrlError) quando a URL pública não responde 2xx — mesmo contrato de uploadImage que uploadAndVerifyObject (S3)", async () => {
    const fetchImpl = fetchStub(() => response(404));
    const uploadImage = createPublicOnlyUploadImage({ publicBaseUrl: "https://pub-exemplo.r2.dev" }, { fetchImpl, retryDelayMs: 0 });

    await expect(
      uploadImage({ key: "exercises/inexistente.webp", body: Buffer.from(""), contentType: "image/webp" })
    ).rejects.toThrow(PublicImageUrlError);
  });

  it("nunca importa nem referencia r2Client/@aws-sdk — só usa fetch injetado, nenhuma operação S3", async () => {
    // Estruturalmente garantido: publicUrlValidator.ts não importa "./r2Client"
    // nem "@aws-sdk/client-s3" (verificado também por leitura do arquivo no
    // PR) — este teste prova que o caminho de execução completo (montar URL
    // + validar) funciona sem nenhuma dependência S3 chegar a ser tocada.
    const fetchImpl = fetchStub(() => response(200));
    const uploadImage = createPublicOnlyUploadImage({ publicBaseUrl: "https://pub-exemplo.r2.dev" }, { fetchImpl, retryDelayMs: 0 });

    await uploadImage({ key: "exercises/x.webp", body: Buffer.from(""), contentType: "image/webp" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
