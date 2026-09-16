import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchExercises } from "./client";
import { ApiNinjasError } from "./errors";

/// Testes de contrato do client (FIT-020) — inteiramente com `fetch`
/// substituído por fixtures locais. Nenhum destes testes toca a rede real;
/// nenhuma chave real é usada (ver ADR-004: nenhuma chave nova foi
/// fornecida a esta História).
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const validFixture = [
  {
    name: "Incline Hammer Curl",
    type: "strength",
    muscle: "biceps",
    equipments: "dumbbell",
    difficulty: "beginner",
    instructions: "Sit on an incline bench...",
    safety_info: "Do not swing the weights.",
  },
];

describe("searchExercises (FIT-020)", () => {
  const originalKey = process.env.API_NINJAS_API_KEY;

  beforeEach(() => {
    process.env.API_NINJAS_API_KEY = "chave-de-teste-fake";
  });

  afterEach(() => {
    process.env.API_NINJAS_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("resposta válida: retorna DTOs normalizados, preservando o texto original", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, validFixture));

    const result = await searchExercises({ muscle: "biceps" }, { fetchImpl });

    expect(result).toEqual([
      {
        name: "Incline Hammer Curl",
        type: "strength",
        muscle: "biceps",
        equipments: "dumbbell",
        difficulty: "beginner",
        instructions: "Sit on an incline bench...",
        safetyInfo: "Do not swing the weights.",
      },
    ]);
  });

  it("resposta vazia: retorna lista vazia, sem erro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));

    const result = await searchExercises({ name: "algo-inexistente" }, { fetchImpl });

    expect(result).toEqual([]);
  });

  it("campos opcionais ausentes: tornam-se null, nunca string vazia nem erro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ name: "Push-up" }]));

    const result = await searchExercises({}, { fetchImpl });

    expect(result).toEqual([
      { name: "Push-up", type: null, muscle: null, equipments: null, difficulty: null, instructions: null, safetyInfo: null },
    ]);
  });

  it("item sem nome: RESPOSTA_INVALIDA", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ muscle: "biceps" }]));

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "RESPOSTA_INVALIDA" });
  });

  it("resposta não é uma lista: RESPOSTA_INVALIDA", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { error: "não é uma lista" }));

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "RESPOSTA_INVALIDA" });
  });

  it("corpo não é JSON válido: RESPOSTA_INVALIDA", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>não é json</html>", { status: 200 }));

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "RESPOSTA_INVALIDA" });
  });

  it("resposta excede o número máximo de itens aceito: RESPOSTA_INVALIDA", async () => {
    const oversized = Array.from({ length: 51 }, (_, index) => ({ name: `Exercício ${index}` }));
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, oversized));

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "RESPOSTA_INVALIDA" });
  });

  it("corpo da resposta excede o tamanho máximo aceito: RESPOSTA_INVALIDA", async () => {
    const hugeText = "x".repeat(1_000_001);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(hugeText, { status: 200 }));

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "RESPOSTA_INVALIDA" });
  });

  it("401: NAO_AUTORIZADO", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "NAO_AUTORIZADO" });
  });

  it("403: PROIBIDO", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));
    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "PROIBIDO" });
  });

  it("429: LIMITE_EXCEDIDO", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Too Many Requests", { status: 429 }));
    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "LIMITE_EXCEDIDO" });
  });

  it("500: ERRO_SERVIDOR", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }));
    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "ERRO_SERVIDOR" });
  });

  it("timeout: TIMEOUT, nunca fica pendente indefinidamente", async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    await expect(searchExercises({}, { fetchImpl, timeoutMs: 10 })).rejects.toMatchObject({ kind: "TIMEOUT" });
  });

  it("variável de ambiente ausente: CHAVE_AUSENTE, nenhuma tentativa de chamada de rede", async () => {
    delete process.env.API_NINJAS_API_KEY;
    const fetchImpl = vi.fn();

    await expect(searchExercises({}, { fetchImpl })).rejects.toMatchObject({ kind: "CHAVE_AUSENTE" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a chave nunca aparece na URL da requisição — vai exclusivamente no header X-Api-Key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));

    await searchExercises({ name: "flexão" }, { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).not.toContain("chave-de-teste-fake");
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("chave-de-teste-fake");
  });

  it("nenhum erro lançado inclui a chave configurada na mensagem", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    try {
      await searchExercises({}, { fetchImpl });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiNinjasError);
      expect((error as Error).message).not.toContain("chave-de-teste-fake");
    }
  });

  it("parâmetros são codificados na query string, apenas os informados e não-vazios", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));

    await searchExercises({ name: "flexão de braço", muscle: "", type: "strength" }, { fetchImpl });

    const [url] = fetchImpl.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("name")).toBe("flexão de braço");
    expect(parsed.searchParams.get("type")).toBe("strength");
    expect(parsed.searchParams.has("muscle")).toBe(false);
  });
});
