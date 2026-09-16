import "server-only";
import { ApiNinjasError } from "./errors";
import { toExerciseDTO } from "./adapter";
import type { ApiNinjasExerciseRaw, ExerciseDTO, SearchExercisesInput } from "./types";

const API_BASE_URL = "https://api.api-ninjas.com/v1/exercises";
const DEFAULT_TIMEOUT_MS = 8000;
/// A documentação oficial (ver ADR-004) limita `GET /v1/exercises` a 5
/// resultados por chamada. Este limite não é usado para paginar (offset é
/// recurso premium, não presumido disponível) — é apenas uma rede de
/// segurança contra uma resposta inesperadamente grande (contrato alterado
/// pelo fornecedor, ou resposta malformada/maliciosa).
const MAX_RESULTS_PER_CALL = 50;
/// Limite defensivo de tamanho do corpo da resposta (bytes, como texto) —
/// protege contra um corpo anormalmente grande antes mesmo de tentar
/// `JSON.parse`.
const MAX_RESPONSE_BYTES = 1_000_000;

type FetchLike = typeof fetch;

function buildQueryString(input: SearchExercisesInput): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  }
  return params.toString();
}

function requireApiKey(): string {
  const key = process.env.API_NINJAS_API_KEY;
  if (!key) {
    throw new ApiNinjasError(
      "CHAVE_AUSENTE",
      "API_NINJAS_API_KEY não está configurada — a busca na API Ninjas está indisponível."
    );
  }
  return key;
}

function mapStatusToError(status: number): ApiNinjasError {
  if (status === 401) {
    return new ApiNinjasError("NAO_AUTORIZADO", "API Ninjas rejeitou a chave configurada (401).");
  }
  if (status === 403) {
    return new ApiNinjasError("PROIBIDO", "API Ninjas negou acesso ao recurso solicitado (403).");
  }
  if (status === 429) {
    return new ApiNinjasError("LIMITE_EXCEDIDO", "API Ninjas reportou limite de requisições excedido (429).");
  }
  if (status >= 500) {
    return new ApiNinjasError("ERRO_SERVIDOR", `API Ninjas retornou erro de servidor (${status}).`);
  }
  return new ApiNinjasError("RESPOSTA_INVALIDA", `API Ninjas retornou status inesperado (${status}).`);
}

/// Consulta `GET /v1/exercises`. Nunca deve ser chamada fora deste módulo —
/// nenhum outro ponto da aplicação sabe o endpoint, o header de
/// autenticação ou o formato bruto da resposta.
///
/// `fetchImpl`/`timeoutMs` existem exclusivamente para testes (o mesmo
/// padrão de injeção de dependência usado em `identity`/`students`) —
/// nenhum chamador de produção deve informá-los.
export async function searchExercises(
  input: SearchExercisesInput,
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<ExerciseDTO[]> {
  const apiKey = requireApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const query = buildQueryString(input);
  const url = query ? `${API_BASE_URL}?${query}` : API_BASE_URL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { "X-Api-Key": apiKey },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiNinjasError("TIMEOUT", `A busca na API Ninjas excedeu o tempo limite de ${timeoutMs}ms.`);
    }
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Falha de rede ao consultar a API Ninjas.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw mapStatusToError(response.status);
  }

  const rawText = await response.text();
  if (rawText.length > MAX_RESPONSE_BYTES) {
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Resposta da API Ninjas excedeu o tamanho máximo aceito.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Resposta da API Ninjas não é um JSON válido.");
  }

  if (!Array.isArray(parsed)) {
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Resposta da API Ninjas não é uma lista.");
  }
  if (parsed.length > MAX_RESULTS_PER_CALL) {
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Resposta da API Ninjas excedeu o número máximo de itens aceito.");
  }

  return parsed.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new ApiNinjasError("RESPOSTA_INVALIDA", "Item da resposta da API Ninjas não é um objeto.");
    }
    return toExerciseDTO(item as ApiNinjasExerciseRaw);
  });
}
